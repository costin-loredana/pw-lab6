const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const JWT_SECRET = "lab7-super-secret-key-2026";

app.use(cors());
app.use(express.json());

// ─── Database Config ──────────────────────────────────────────
const DB_PATH = path.join(__dirname, "database.json");

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      console.log(" Database loaded from file");
      return {
        expenses: data.expenses || [],
        categories: data.categories || [],
        salary: data.salary || { amount: null },
      };
    }
  } catch (err) {
    console.error(" Error loading database:", err.message);
  }
  
  console.log(" Creating new database with sample data");
  return {
    expenses: [
      { id: "ex1", date: "2026-04-01", amount: 7500.00, category: "housing", description: "Chirie apartament Aprilie" },
      { id: "ex2", date: "2026-04-05", amount: 485.50, category: "food", description: "Cumpărături săptămânale" },
      { id: "ex3", date: "2026-04-10", amount: 120.00, category: "transport", description: "Alimentare combustibil" },
      { id: "ex4", date: "2026-04-12", amount: 320.00, category: "health", description: "Consultație medicală" },
      { id: "ex5", date: "2026-05-01", amount: 210.00, category: "entertainment", description: "Cinema & restaurant" },
    ],
    categories: [
      { id: "food", name: "Alimentație & Produse", color: "#2e7d32" },
      { id: "transport", name: "Transport & Combustibil", color: "#546e7a" },
      { id: "housing", name: "Chirie & Servicii Comunale", color: "#455a64" },
      { id: "health", name: "Sănătate & Farmacie", color: "#c62828" },
      { id: "entertainment", name: "Timp Liber & Cultură", color: "#1565c0" },
      { id: "shopping", name: "Cumpărături & Haine", color: "#6a1b9a" },
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
    console.error("❌ Error saving database:", err.message);
  }
}

const db = loadDatabase();
let expenses = db.expenses;
let categories = db.categories;
let salaryConfig = db.salary;

function uid() { 
  return Math.random().toString(36).slice(2) + Date.now().toString(36); 
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
          error: `Forbidden — requires '${requiredPermission}' permission`,
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

// ─── Root ────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ 
    message: "Finance Tracker API", 
    version: "3.0.0",
    stage: "Expenses CRUD",
    storage: "JSON File (persistent)",
  });
});

// ─── Token ───────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
//  EXPENSES CRUD + STATS
// ═══════════════════════════════════════════════════════════════

// GET /expenses
app.get("/expenses", auth("READ"), (req, res) => {
  res.json(expenses);
});

// GET /expenses/:id
app.get("/expenses/:id", auth("READ"), (req, res) => {
  const exp = expenses.find(e => e.id === req.params.id);
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  res.json(exp);
});

// POST /expenses
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
  
  const newExpense = { id: uid(), date, amount: +amount, category, description: description || "" };
  expenses.unshift(newExpense);
  saveDatabase();
  
  res.status(201).json({ message: "Expense created", expense: newExpense });
});

// PUT /expenses/:id
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
  
  res.json({ message: "Expense updated", expense: expenses[idx] });
});

// DELETE /expenses/:id
app.delete("/expenses/:id", auth("DELETE"), (req, res) => {
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Expense not found" });
  
  expenses.splice(idx, 1);
  saveDatabase();
  
  res.json({ message: "Expense deleted successfully" });
});

// GET /categories (read-only for now)
app.get("/categories", auth("READ"), (req, res) => {
  const withCounts = categories.map(c => ({
    ...c,
    expenseCount: expenses.filter(e => e.category === c.id).length,
  }));
  res.json(withCounts);
});

// ═══════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════

app.get("/stats", auth("READ"), (req, res) => {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const curMonth = new Date().toISOString().slice(0, 7);
  const curMonthExpenses = expenses.filter(e => e.date.startsWith(curMonth));
  const curMonthTotal = curMonthExpenses.reduce((s, e) => s + e.amount, 0);
  
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  
  const byMonth = {};
  expenses.forEach(e => {
    const m = e.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + e.amount;
  });
  
  res.json({
    totalExpenses: expenses.length,
    totalAmount: total,
    currentMonth: { month: curMonth, total: curMonthTotal, count: curMonthExpenses.length },
    byCategory,
    byMonth,
  });
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Server running at http://localhost:${PORT}`);
  console.log(` Stage 3-1: Expenses CRUD + Stats Ready!\n`);
});