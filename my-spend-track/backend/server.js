const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// In-memory database
let expenses = [
  { id: "1", date: "2026-04-01", amount: 7500.00, category: "housing", description: "Chirie apartament" },
  { id: "2", date: "2026-04-05", amount: 485.50, category: "food", description: "Cumpărături săptămânale" },
];

let categories = [
  { id: "food", name: "Alimentație", color: "#2e7d32" },
  { id: "housing", name: "Chirie", color: "#455a64" },
];

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Finance Tracker API v1.0", status: "running" });
});

// GET all expenses
app.get("/expenses", (req, res) => {
  res.json(expenses);
});

// GET all categories
app.get("/categories", (req, res) => {
  res.json(categories);
});

app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
  console.log(` Expenses: http://localhost:${PORT}/expenses`);
  console.log(` Categories: http://localhost:${PORT}/categories`);
});