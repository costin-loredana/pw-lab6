import { useState, useEffect } from "react";
import "./App.css";

const STORAGE_KEY = "registru_finante_md";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Alimentație & Produse" },
  { id: "transport", name: "Transport & Combustibil" },
  { id: "housing", name: "Chirie & Servicii Comunale" },
  { id: "health", name: "Sănătate & Farmacie" },
  { id: "entertainment", name: "Timp Liber & Cultură" },
  { id: "shopping", name: "Cumpărături & Haine" },
  { id: "other", name: "Diverse" },
];

const SAMPLE = [
  { id: "1", date: "2026-04-01", amount: 7500, category: "housing", description: "Chirie apartament (Chisinau)" },
  { id: "2", date: "2026-04-05", amount: 485.50, category: "food", description: "Produse alimentare - Linella" },
  { id: "3", date: "2026-04-10", amount: 120, category: "transport", description: "Taxi / Transport public" },
];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState("light");
  const [expenses, setExpenses] = useState(SAMPLE);
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newExp, setNewExp] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      setExpenses(d.expenses);
      setTheme(d.theme || "light");
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses, theme }));
      document.body.className = theme === "dark" ? "dark-theme" : "";
    }
  }, [expenses, theme, isLoaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  return (
    <div className="container">
      <header>
        <div className="title-group">
          <p>Monitorizare Cheltuieli Personale</p>
          <h1>Registru</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </header>
    </div>
  );
}