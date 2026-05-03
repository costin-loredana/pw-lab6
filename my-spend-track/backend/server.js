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

// Database Config
const DB_PATH = path.join(__dirname, "database.json");

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      console.log("Database loaded from file");
      return {
        expenses: data.expenses || [],
        categories: data.categories || [],
        salary: data.salary || { amount: null },
      };
    }
  } catch (err) {
    console.error("Error loading database:", err.message);
  }
  
  console.log("Creating new database with sample data");
  return {
    expenses: [
      { id: "ex1", date: "2026-04-01", amount: 7500.00, category: "housing", description: "Chirie apartament Aprilie" },
      { id: "ex2", date: "2026-04-05", amount: 485.50, category: "food", description: "Cumparaturi saptamanale" },
      { id: "ex3", date: "2026-04-10", amount: 120.00, category: "transport", description: "Alimentare combustibil" },
      { id: "ex4", date: "2026-04-12", amount: 320.00, category: "health", description: "Consultatie medicala" },
      { id: "ex5", date: "2026-05-01", amount: 210.00, category: "entertainment", description: "Cinema & restaurant" },
    ],
    categories: [
      { id: "food", name: "Alimentatie & Produse", color: "#2e7d32" },
      { id: "transport", name: "Transport & Combustibil", color: "#546e7a" },
      { id: "housing", name: "Chirie & Servicii Comunale", color: "#455a64" },
      { id: "health", name: "Sanatate & Farmacie", color: "#c62828" },
      { id: "entertainment", name: "Timp Liber & Cultura", color: "#1565c0" },
      { id: "shopping", name: "Cumparaturi & Haine", color: "#6a1b9a" },
      { id: "other", name: "Diverse", color: "#9e9e9e" },
    ],
    salary: { amount: null },
  };
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

// Helpers
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

// Role & Permission Config
const ROLE_PERMISSIONS = {
  ADMIN:   ["READ", "WRITE", "DELETE"],
  WRITER:  ["READ", "WRITE"],
  VISITOR: ["READ"],
};

// JWT Middleware
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

// Root
app.get("/", (req, res) => {
  res.json({ message: "Finance Tracker API", version: "4.0.0", stage: "Pagination" });
});

// Token
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

// EXPENSES CRUD with Pagination
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

// CATEGORIES CRUD with Pagination
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

// Swagger Documentation
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
    schemas: {
      Expense: {
        type: "object",
        properties: {
          id:          { type: "string", example: "abc123" },
          date:        { type: "string", format: "date", example: "2026-04-01" },
          amount:      { type: "number", example: 7500.00 },
          category:    { type: "string", example: "housing" },
          description: { type: "string", example: "Chirie apartament" },
        },
      },
      Category: {
        type: "object",
        properties: {
          id:           { type: "string", example: "food" },
          name:         { type: "string", example: "Alimentatie & Produse" },
          color:        { type: "string", example: "#2e7d32" },
          expenseCount: { type: "integer", example: 5 },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page:       { type: "integer" },
          limit:      { type: "integer" },
          total:      { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/token": {
      post: {
        tags: ["Auth"],
        summary: "Get JWT token",
        description: "Returns a JWT valid for 60 seconds. Pass role or permissions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["ADMIN", "WRITER", "VISITOR"] },
                  permissions: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "JWT token returned" },
          400: { description: "Invalid role or permissions" },
        },
      },
    },
    "/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses with pagination and filters",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page",     in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",    in: "query", schema: { type: "integer", default: 20 } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "month",    in: "query", schema: { type: "string", example: "2026-04" } },
          { name: "sort",     in: "query", schema: { type: "string", enum: ["date_desc", "date_asc", "amount_desc", "amount_asc"] } },
        ],
        responses: {
          200: { description: "Paginated list of expenses" },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Expenses"],
        summary: "Create a new expense",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["date", "amount", "category"],
                properties: {
                  date:        { type: "string", format: "date" },
                  amount:      { type: "number" },
                  category:    { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Expense created" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/expenses/{id}": {
      get: {
        tags: ["Expenses"],
        summary: "Get expense by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Expense found" },
          404: { description: "Not found" },
        },
      },
      put: {
        tags: ["Expenses"],
        summary: "Update expense",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Expense updated" },
          404: { description: "Not found" },
        },
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete expense",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          204: { description: "Expense deleted" },
          404: { description: "Not found" },
        },
      },
    },
    "/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories with pagination",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page",  in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "Paginated list of categories" } },
      },
      post: {
        tags: ["Categories"],
        summary: "Create a new category",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:  { type: "string" },
                  color: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Category created" },
          409: { description: "Category already exists" },
        },
      },
    },
    "/categories/{id}": {
      get: {
        tags: ["Categories"],
        summary: "Get category by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Category found" } },
      },
      put: {
        tags: ["Categories"],
        summary: "Update category",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Category updated" } },
      },
      delete: {
        tags: ["Categories"],
        summary: "Delete category",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          204: { description: "Category deleted" },
          409: { description: "Category has associated expenses" },
        },
      },
    },
    "/salary": {
      get: {
        tags: ["Salary"],
        summary: "Get salary config",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Current salary" } },
      },
      put: {
        tags: ["Salary"],
        summary: "Update salary",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { amount: { type: "number", nullable: true } },
              },
            },
          },
        },
        responses: { 200: { description: "Salary updated" } },
      },
    },
    "/stats": {
      get: {
        tags: ["Stats"],
        summary: "Get aggregated statistics",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Statistics object" } },
      },
    },
  },
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
  console.log(`Stage 4b: Swagger Documentation Ready`);
});