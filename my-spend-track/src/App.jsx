import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

const STORAGE_KEY = "registru_finante_editorial_v2";

const SAMPLE_DATA = [
  { id: "1", date: "2026-03-15", amount: 1200.00, category: "shopping", description: "Monitor nou" },
  { id: "2", date: "2026-04-01", amount: 7500.00, category: "housing", description: "Chirie apartament" },
  { id: "3", date: "2026-04-05", amount: 485.50, category: "food", description: "Cumpărături săptămânale" },
  { id: "4", date: "2026-04-10", amount: 120.00, category: "transport", description: "Alimentare rezervor" },
  { id: "5", date: "2026-04-12", amount: 320.00, category: "health", description: "Consultație + medicamente" },
  { id: "6", date: "2026-04-18", amount: 210.00, category: "entertainment", description: "Cinema & restaurant" },
];

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("sinteza");
  const [expenses, setExpenses] = useState([]);
  const [salary, setSalary] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      setExpenses(d.expenses || SAMPLE_DATA);
      setTheme(d.theme || "light");
      setSalary(d.salary || null);
    } else {
      setExpenses(SAMPLE_DATA);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses, theme, salary }));
      document.body.className = theme === "dark" ? "dark-theme" : "";
    }
  }, [expenses, theme, salary, isLoaded]);

  const formatCurrency = (val) => val.toLocaleString("ro-MD", { minimumFractionDigits: 2 }) + " MDL";

  const curMonth = new Date().toISOString().slice(0, 7);
  const curMonthExpenses = useMemo(() =>
    expenses.filter(e => e.date.startsWith(curMonth)),
    [expenses, curMonth]);

  const curMonthTotal = useMemo(() =>
    curMonthExpenses.reduce((s, e) => s + e.amount, 0),
    [curMonthExpenses]);

  const totalAll = useMemo(() =>
    expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]);

  const salaryPct = salary ? Math.min(100, Math.round(curMonthTotal / salary * 100)) : null;
  const remaining = salary ? salary - curMonthTotal : null;

  if (!isLoaded) return null;

  return (
    <div className="container">
      <header>
        <div className="title-group">
          <p>Sistem de Evidență și Gestiune</p>
          <h1>{view === "sinteza" ? "Sinteză" : "Registru"}</h1>
        </div>
        <div className="header-actions">
          <div className="view-switcher">
            <button className={view === "sinteza" ? "active" : ""} onClick={() => setView("sinteza")}>Dashboard</button>
            <button className={view === "jurnal" ? "active" : ""} onClick={() => setView("jurnal")}>Jurnal</button>
          </div>
          <button className="btn btn-ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Mod Luminos" : "Mod Întunecat"}
          </button>
        </div>
      </header>

      <main className="fade-in">
        <div className="summary-grid">
          <div className="card highlight">
            <div className="card-label">Total Cheltuieli Înregistrate</div>
            <div className="card-value">{formatCurrency(totalAll)}</div>
          </div>
          <div className="card">
            <div className="card-label">Cheltuieli Luna Curentă</div>
            <div className="card-value">{formatCurrency(curMonthTotal)}</div>
            {salaryPct !== null && (
              <>
                <div className="card-sub">{salaryPct}% din salariu</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${salaryPct}%`,
                      background: salaryPct > 90 ? "#ef4444" : salaryPct > 70 ? "#f59e0b" : "#10b981"
                    }}
                  />
                </div>
              </>
            )}
          </div>
          {salary ? (
            <div className="card salary-card">
              <div className="card-label">Buget Rămas</div>
              <div className="card-value" style={{ color: remaining < 0 ? "#ef4444" : remaining < salary * 0.2 ? "#f59e0b" : "inherit" }}>
                {formatCurrency(remaining)}
              </div>
              <div className="card-sub">din {formatCurrency(salary)} salariu</div>
            </div>
          ) : (
            <div className="card card-dashed" onClick={() => {}}>
              <div className="card-plus">+</div>
              <div className="card-label">Adaugă Salariu</div>
              <div className="card-hint">Urmărește bugetul rămas</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}