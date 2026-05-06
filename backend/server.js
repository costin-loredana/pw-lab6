const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const app = express();
const PORT = 3001;
const JWT_SECRET = "lab7-super-secret-key-2026";

app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "database.json");

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      console.log("Database loaded from file");
      return {
        expenses: data.expenses || [],
        categories: data.categories || getDefaultCategories(),
        salary: data.salary || { amount: null },
      };
    }
  } catch (err) {
    console.error("Error loading database:", err.message);
  }
  
  console.log("Creating new database");
  return {
    expenses: [],
    categories: getDefaultCategories(),
    salary: { amount: null },
  };
}

function getDefaultCategories() {
  return [
    { id: "food", name: "Alimentatie & Produse", color: "#2e7d32" },
    { id: "transport", name: "Transport & Combustibil", color: "#546e7a" },
    { id: "housing", name: "Chirie & Servicii Comunale", color: "#455a64" },
    { id: "health", name: "Sanatate & Farmacie", color: "#c62828" },
    { id: "entertainment", name: "Timp Liber & Cultura", color: "#1565c0" },
    { id: "shopping", name: "Cumparaturi & Haine", color: "#6a1b9a" },
    { id: "other", name: "Diverse", color: "#9e9e9e" },
  ];
}

function saveDatabase() {
  try {
    const data = { expenses, categories, salary: salaryConfig };
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving database:", err.message);
  }
}

const db = loadDatabase();
let expenses = db.expenses;
let categories = db.categories;
let salaryConfig = db.salary;

function uid() { 
  return Math.random().toString(36).slice(2) + Date.now().toString(36); 
}

function paginate(array, page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  const total = array.length;
  const totalPages = Math.ceil(total / l);
  const data = array.slice((p - 1) * l, p * l);
  return { data, pagination: { page: p, limit: l, total, totalPages } };
}

const ROLE_PERMISSIONS = {
  ADMIN:   ["READ", "WRITE", "DELETE"],
  WRITER:  ["READ", "WRITE"],
  VISITOR: ["READ"],
};

function auth(requiredPermission) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      
      const permissions = payload.permissions || ROLE_PERMISSIONS[payload.role] || [];
      
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: `Forbidden - requires '${requiredPermission}' permission`,
          yourPermissions: permissions,
        });
      }
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

app.get("/", (req, res) => {
  res.json({ message: "Finance Tracker API", version: "4.0.0", docs: "/docs" });
});

app.post("/token", (req, res) => {
  const { role, permissions } = req.body || {};
  
  if (role && ROLE_PERMISSIONS[role]) {
    const token = jwt.sign(
      { role, permissions: ROLE_PERMISSIONS[role] },
      JWT_SECRET,
      { expiresIn: "60s" }
    );
    return res.json({ token, expiresIn: 60, role, permissions: ROLE_PERMISSIONS[role] });
  }
  
  if (Array.isArray(permissions)) {
    const token = jwt.sign({ permissions }, JWT_SECRET, { expiresIn: "60s" });
    return res.json({ token, expiresIn: 60, permissions });
  }
  
  res.status(400).json({ error: "Provide 'role' or 'permissions'" });
});

// EXPENSES
app.get("/expenses", auth("READ"), (req, res) => {
  const { page = 1, limit = 20, category, month, sort = "date_desc" } = req.query;
  
  let filtered = [...expenses];
  
  if (category && category !== "all") {
    filtered = filtered.filter(e => e.category === category);
  }
  if (month && month !== "all") {
    filtered = filtered.filter(e => e.date.startsWith(month));
  }
  
  if (sort === "date_desc") filtered.sort((a, b) => b.date.localeCompare(a.date));
  else if (sort === "date_asc") filtered.sort((a, b) => a.date.localeCompare(b.date));
  else if (sort === "amount_desc") filtered.sort((a, b) => b.amount - a.amount);
  else if (sort === "amount_asc") filtered.sort((a, b) => a.amount - b.amount);
  
  res.json(paginate(filtered, page, limit));
});

app.get("/expenses/:id", auth("READ"), (req, res) => {
  const exp = expenses.find(e => e.id === req.params.id);
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  res.json(exp);
});

app.post("/expenses", auth("WRITE"), (req, res) => {
  const { date, amount, category, description } = req.body;
  
  if (!date || !amount || !category) {
    return res.status(400).json({ error: "Fields 'date', 'amount', 'category' are required" });
  }
  if (isNaN(+amount) || +amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (!categories.find(c => c.id === category)) {
    return res.status(400).json({ error: `Category '${category}' does not exist` });
  }
  
  const exp = { id: uid(), date, amount: +amount, category, description: description || "" };
  expenses.unshift(exp);
  saveDatabase();
  res.status(201).json(exp);
});

app.put("/expenses/:id", auth("WRITE"), (req, res) => {
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Expense not found" });
  
  const { date, amount, category, description } = req.body;
  
  if (amount !== undefined && (isNaN(+amount) || +amount <= 0)) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (category && !categories.find(c => c.id === category)) {
    return res.status(400).json({ error: `Category '${category}' does not exist` });
  }
  
  expenses[idx] = {
    ...expenses[idx],
    ...(date !== undefined && { date }),
    ...(amount !== undefined && { amount: +amount }),
    ...(category !== undefined && { category }),
    ...(description !== undefined && { description }),
  };
  saveDatabase();
  res.json(expenses[idx]);
});

app.delete("/expenses/:id", auth("DELETE"), (req, res) => {
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Expense not found" });
  expenses.splice(idx, 1);
  saveDatabase();
  res.status(204).send();
});

// CATEGORIES
app.get("/categories", auth("READ"), (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const withCounts = categories.map(c => ({
    ...c,
    expenseCount: expenses.filter(e => e.category === c.id).length,
  }));
  res.json(paginate(withCounts, page, limit));
});

app.get("/categories/:id", auth("READ"), (req, res) => {
  const cat = categories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: "Category not found" });
  res.json({ ...cat, expenseCount: expenses.filter(e => e.category === cat.id).length });
});

app.post("/categories", auth("WRITE"), (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  
  const id = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (categories.find(c => c.id === id)) {
    return res.status(409).json({ error: `Category '${id}' already exists` });
  }
  
  const cat = { id, name: name.trim(), color: color || "#9e9e9e" };
  categories.push(cat);
  saveDatabase();
  res.status(201).json(cat);
});

app.put("/categories/:id", auth("WRITE"), (req, res) => {
  const idx = categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });
  
  const { name, color } = req.body;
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: "Name cannot be empty" });
  
  categories[idx] = { ...categories[idx], ...(name && { name: name.trim() }), ...(color && { color }) };
  saveDatabase();
  res.json(categories[idx]);
});

app.delete("/categories/:id", auth("DELETE"), (req, res) => {
  if (req.params.id === "other") return res.status(400).json({ error: "Cannot delete 'other' category" });
  const idx = categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });
  if (expenses.some(e => e.category === req.params.id)) {
    return res.status(409).json({ error: "Category has associated expenses" });
  }
  categories.splice(idx, 1);
  saveDatabase();
  res.status(204).send();
});

// SALARY
app.get("/salary", auth("READ"), (req, res) => {
  res.json(salaryConfig);
});

app.put("/salary", auth("WRITE"), (req, res) => {
  const { amount } = req.body;
  if (amount !== null && (isNaN(+amount) || +amount < 0)) {
    return res.status(400).json({ error: "Amount must be non-negative or null" });
  }
  salaryConfig.amount = amount !== null ? +amount : null;
  saveDatabase();
  res.json(salaryConfig);
});

// STATS
app.get("/stats", auth("READ"), (req, res) => {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const curMonth = new Date().toISOString().slice(0, 7);
  const curMonthExpenses = expenses.filter(e => e.date.startsWith(curMonth));
  const curMonthTotal = curMonthExpenses.reduce((s, e) => s + e.amount, 0);
  
  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  
  const byMonth = {};
  expenses.forEach(e => { const m = e.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + e.amount; });
  
  res.json({
    totalExpenses: expenses.length,
    totalAmount: total,
    currentMonth: { month: curMonth, total: curMonthTotal, count: curMonthExpenses.length },
    byCategory,
    byMonth,
    salary: salaryConfig.amount,
    remaining: salaryConfig.amount !== null ? salaryConfig.amount - curMonthTotal : null,
  });
});

// SWAGGER
const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Finance Tracker API",
    version: "4.0.0",
    description: "REST API for personal finance tracker with JWT authentication, pagination, and CRUD operations.",
  },
  servers: [{ url: `http://localhost:${PORT}`, description: "Local server" }],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/token": {
      post: {
        tags: ["Auth"],
        summary: "Get JWT token",
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { role: { type: "string", enum: ["ADMIN", "WRITER", "VISITOR"] } } } } },
        },
        responses: { 200: { description: "JWT token" } },
      },
    },
    "/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses (paginated)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "Paginated expenses" } },
      },
      post: {
        tags: ["Expenses"],
        summary: "Create expense",
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: "Created" } },
      },
    },
    "/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Categories list" } },
      },
      post: {
        tags: ["Categories"],
        summary: "Create category",
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: "Created" } },
      },
    },
    "/stats": {
      get: {
        tags: ["Stats"],
        summary: "Get statistics",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Statistics" } },
      },
    },
  },
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
  console.log("Stage 4: Ready");
});