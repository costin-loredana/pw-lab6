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
    console.error(" Error saving database:", err.message);
  }
}

// ─── Initialize Database ─────────────────────────────────────
const db = loadDatabase();
let expenses = db.expenses;
let categories = db.categories;
let salaryConfig = db.salary;

// ─── Role & Permission Config ─────────────────────────────────
const ROLE_PERMISSIONS = {
  ADMIN:   ["READ", "WRITE", "DELETE"],
  WRITER:  ["READ", "WRITE"],
  VISITOR: ["READ"],
};

// ─── JWT Middleware ───────────────────────────────────────────
function auth(requiredPermission) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "Missing Authorization header",
        hint: "Use: Authorization: Bearer <your-token>",
        getToken: "POST /token with { role: 'ADMIN' }"
      });
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
          requiredPermission: requiredPermission,
        });
      }
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ 
          error: "Token expired",
          hint: "Get a new token at POST /token"
        });
      }
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

// ─── Routes ──────────────────────────────────────────────────

// Root
app.get("/", (req, res) => {
  res.json({ 
    message: "Finance Tracker API", 
    version: "2.0.0",
    stage: "JWT Authentication",
    storage: "JSON File (persistent)",
    auth: "Required for all data endpoints",
    getToken: "POST /token"
  });
});

// POST /token - Get JWT
app.post("/token", (req, res) => {
  const { role, permissions } = req.body || {};
  
  if (role && ROLE_PERMISSIONS[role]) {
    const token = jwt.sign(
      { role, permissions: ROLE_PERMISSIONS[role] },
      JWT_SECRET,
      { expiresIn: "60s" }
    );
    return res.json({
      token,
      expiresIn: 60,
      role,
      permissions: ROLE_PERMISSIONS[role],
      hint: "Use this token in Authorization header. Expires in 60 seconds (demo)."
    });
  }
  
  if (Array.isArray(permissions)) {
    const token = jwt.sign({ permissions }, JWT_SECRET, { expiresIn: "60s" });
    return res.json({ token, expiresIn: 60, permissions });
  }
  
  res.status(400).json({
    error: "Provide 'role' (ADMIN|WRITER|VISITOR) or 'permissions' array",
    example: { role: "ADMIN" },
    validRoles: Object.keys(ROLE_PERMISSIONS),
  });
});

// GET /expenses (Protected - READ)
app.get("/expenses", auth("READ"), (req, res) => {
  res.json(expenses);
});

// GET /expenses/:id (Protected - READ)
app.get("/expenses/:id", auth("READ"), (req, res) => {
  const exp = expenses.find(e => e.id === req.params.id);
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  res.json(exp);
});

// GET /categories (Protected - READ)
app.get("/categories", auth("READ"), (req, res) => {
  const withCounts = categories.map(c => ({
    ...c,
    expenseCount: expenses.filter(e => e.category === c.id).length,
  }));
  res.json(withCounts);
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Server running at http://localhost:${PORT}`);
  console.log(` Database: ${DB_PATH}`);
  console.log(` Get token: POST http://localhost:${PORT}/token`);
  console.log(`  Token expires in 60 seconds (demo)`);
  console.log(`\n Stage 2: JWT Authentication Ready!\n`);
});