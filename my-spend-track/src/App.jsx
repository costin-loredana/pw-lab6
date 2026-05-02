import React, { useState, useEffect, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Chart as ChartJS, ArcElement, Tooltip as CJTooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import "./App.css";

ChartJS.register(ArcElement, CJTooltip, Legend);

const STORAGE_KEY = "registru_finante_editorial_v6";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Alimentație & Produse", color: "#2e7d32" },
  { id: "transport", name: "Transport & Combustibil", color: "#546e7a" },
  { id: "housing", name: "Chirie & Servicii Comunale", color: "#455a64" },
  { id: "health", name: "Sănătate & Farmacie", color: "#c62828" },
  { id: "entertainment", name: "Timp Liber & Cultură", color: "#1565c0" },
  { id: "shopping", name: "Cumpărături & Haine", color: "#6a1b9a" },
  { id: "other", name: "Diverse", color: "#9e9e9e" },
];

const DONUT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

const CSV_EXAMPLE = `Dată,Sumă (MDL),Categorie ID,Categorie Nume,Descriere
2026-04-01,7500.00,housing,"Chirie & Servicii Comunale","Chirie apartament Aprilie"
2026-04-05,485.50,food,"Alimentație & Produse","Cumpărături săptămânale"
2026-04-10,120.00,transport,"Transport & Combustibil","Alimentare combustibil"
2026-04-12,320.00,health,"Sănătate & Farmacie","Consultație medicală"
2026-04-18,210.00,entertainment,"Timp Liber & Cultură","Cinema & restaurant"`;

const LLM_EXAMPLE = `# Registru Cheltuieli — Export Text
Generat: ${new Date().toLocaleString("ro-RO")}
Total înregistrări: 5

## Categorii
- [food] Alimentație & Produse
- [transport] Transport & Combustibil
- [housing] Chirie & Servicii Comunale
- [health] Sănătate & Farmacie
- [entertainment] Timp Liber & Cultură

## Cheltuieli (dată | sumă MDL | categorie_id | descriere)
2026-04-01 | 7500.00 | housing | Chirie apartament Aprilie
2026-04-05 | 485.50 | food | Cumpărături săptămânale
2026-04-10 | 120.00 | transport | Alimentare combustibil
2026-04-12 | 320.00 | health | Consultație medicală
2026-04-18 | 210.00 | entertainment | Cinema & restaurant

## Sumar Lunar
2026-04: 8635.50 MDL (5 înregistrări)`;

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("sinteza");
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [salary, setSalary] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [newExp, setNewExp] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "", category: "food", description: ""
  });
  const [newCategory, setNewCategory] = useState({ name: "", color: "#6366f1" });
  const [editingCategory, setEditingCategory] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [copiedExample, setCopiedExample] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      setExpenses(d.expenses || []);
      setCategories(d.categories || DEFAULT_CATEGORIES);
      setTheme(d.theme || "light");
      setSalary(d.salary || null);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses, categories, theme, salary }));
      document.body.className = theme === "dark" ? "dark-theme" : "";
    }
  }, [expenses, categories, theme, salary, isLoaded]);

  const showToast = (msg, type = "success") => { 
    setToast(msg); 
    setToastType(type);
    setTimeout(() => setToast(null), 3000); 
  };
  
  const formatCurrency = (val) => val.toLocaleString("ro-MD", { minimumFractionDigits: 2 }) + " MDL";

  const monthsList = useMemo(() =>
    [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse(),
    [expenses]);

  const filteredExpenses = useMemo(() =>
    expenses
      .filter(e => filterCat === "all" || e.category === filterCat)
      .filter(e => filterMonth === "all" || e.date.slice(0, 7) === filterMonth)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, filterCat, filterMonth]);

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

  const uniqueMonths = useMemo(() =>
    [...new Set(expenses.map(e => e.date.slice(0, 7)))].length,
    [expenses]);

  const topCategory = useMemo(() => {
    const totals = {};
    curMonthExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return null;
    const cat = categories.find(c => c.id === sorted[0][0]);
    return { cat, total: sorted[0][1] };
  }, [curMonthExpenses, categories]);

  const donutData = useMemo(() => {
    const totals = {};
    curMonthExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([id, total]) => ({ id, total, cat: categories.find(c => c.id === id) }));
  }, [curMonthExpenses, categories]);

  const donutChartData = {
    labels: donutData.map(d => d.cat?.name || d.id),
    datasets: [{
      data: donutData.map(d => d.total),
      backgroundColor: DONUT_COLORS.slice(0, donutData.length),
      borderWidth: 2,
      borderColor: theme === "dark" ? "#151b23" : "#ffffff",
      hoverOffset: 6,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` }
      }
    }
  };

  const chartData = useMemo(() => {
    const stats = {};
    expenses.forEach(e => {
      const mKey = e.date.slice(0, 7);
      stats[mKey] = (stats[mKey] || 0) + e.amount;
    });
    return Object.entries(stats)
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        const dateObj = new Date(parseInt(y), parseInt(m) - 1);
        const monthName = dateObj.toLocaleDateString("ro-RO", { month: "short" });
        return { label: `${monthName} '${y.slice(2)}`, total: val, rawDate: key };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-6);
  }, [expenses]);

  const salaryPct = salary ? Math.min(100, Math.round(curMonthTotal / salary * 100)) : null;
  const remaining = salary ? salary - curMonthTotal : null;

  // ═══════════════════════════════════
  // CATEGORY MANAGEMENT
  // ═══════════════════════════════════
  
  const addCategory = () => {
    if (!newCategory.name.trim()) {
      showToast("Numele categoriei este obligatoriu", "error");
      return;
    }
    const id = newCategory.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (categories.find(c => c.id === id)) {
      showToast("Există deja o categorie cu acest nume", "error");
      return;
    }
    setCategories(prev => [...prev, { id, name: newCategory.name, color: newCategory.color }]);
    setNewCategory({ name: "", color: "#6366f1" });
    showToast("Categorie adăugată cu succes");
  };

  const editCategory = (catId) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    setEditingCategory(catId);
    setNewCategory({ name: cat.name, color: cat.color });
  };

  const saveCategoryEdit = () => {
    if (!newCategory.name.trim()) {
      showToast("Numele categoriei este obligatoriu", "error");
      return;
    }
    setCategories(prev => prev.map(c => 
      c.id === editingCategory ? { ...c, name: newCategory.name, color: newCategory.color } : c
    ));
    setEditingCategory(null);
    setNewCategory({ name: "", color: "#6366f1" });
    showToast("Categorie actualizată");
  };

  const deleteCategory = (catId) => {
    if (catId === "other") {
      showToast("Categoria 'Diverse' nu poate fi ștearsă", "error");
      return;
    }
    if (expenses.some(e => e.category === catId)) {
      showToast("Există cheltuieli asociate acestei categorii. Mutați-le mai întâi.", "error");
      return;
    }
    if (!window.confirm("Sigur doriți să ștergeți această categorie?")) return;
    setCategories(prev => prev.filter(c => c.id !== catId));
    showToast("Categorie ștearsă");
  };

  // ═══════════════════════════════════
  // EXPENSE MANAGEMENT
  // ═══════════════════════════════════

  const addExpense = () => {
    if (!newExp.amount || isNaN(+newExp.amount) || +newExp.amount <= 0) {
      showToast("Introduceți o sumă validă și mai mare decât 0", "error");
      return;
    }
    setExpenses(prev => [{ ...newExp, id: uid(), amount: +newExp.amount }, ...prev]);
    setShowAdd(false);
    setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
    showToast("Tranzacție salvată în registru");
  };

  const editExpense = (expense) => {
    setEditingExpense(expense.id);
    setNewExp({
      date: expense.date,
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description
    });
    setShowAdd(true);
  };

  const saveEditExpense = () => {
    if (!newExp.amount || isNaN(+newExp.amount) || +newExp.amount <= 0) {
      showToast("Introduceți o sumă validă", "error");
      return;
    }
    setExpenses(prev => prev.map(e => 
      e.id === editingExpense 
        ? { ...e, ...newExp, amount: +newExp.amount }
        : e
    ));
    setShowAdd(false);
    setEditingExpense(null);
    setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
    showToast("Tranzacție actualizată");
  };

  const deleteExpense = (id) => {
    if (!window.confirm("Sigur doriți să ștergeți această tranzacție?")) return;
    setExpenses(prev => prev.filter(i => i.id !== id));
    showToast("Tranzacție ștearsă");
  };

  const saveSalary = () => {
    const v = +salaryInput;
    if (v < 0) {
      showToast("Introduceți un salariu valid", "error");
      return;
    }
    setSalary(v > 0 ? v : null);
    setShowSalary(false);
    showToast(v > 0 ? "Salariu configurat cu succes" : "Salariu eliminat");
  };

  // ═══════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════

  const download = (content, filename, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };

  const exportCSV = () => {
    const header = ["Dată", "Sumă (MDL)", "Categorie ID", "Categorie Nume", "Descriere"];
    const rows = expenses.map(e => {
      const cat = categories.find(c => c.id === e.category);
      return [
        e.date,
        e.amount.toFixed(2),
        e.category,
        `"${cat?.name || e.category}"`,
        `"${e.description || ""}"`,
      ];
    });
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    download(csv, "registru-cheltuieli.csv", "text/csv");
    showToast("Export CSV finalizat");
  };

  const exportLLM = () => {
    const monthStats = {};
    expenses.forEach(e => {
      const m = e.date.slice(0, 7);
      if (!monthStats[m]) monthStats[m] = { total: 0, count: 0 };
      monthStats[m].total += e.amount;
      monthStats[m].count++;
    });
    const lines = [
      "# Registru Cheltuieli — Export Text",
      `Generat: ${new Date().toLocaleString("ro-RO")}`,
      `Total înregistrări: ${expenses.length}`,
      "",
      "## Categorii",
      ...categories.map(c => `- [${c.id}] ${c.name}`),
      "",
      "## Cheltuieli (dată | sumă MDL | categorie_id | descriere)",
      ...expenses
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(e => `${e.date} | ${e.amount.toFixed(2)} | ${e.category} | ${e.description || ""}`),
      "",
      "## Sumar Lunar",
      ...Object.entries(monthStats)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([m, d]) => `${m}: ${d.total.toFixed(2)} MDL (${d.count} înregistrări)`),
    ];
    download(lines.join("\n"), "registru-cheltuieli-llm.txt", "text/plain");
    showToast("Export LLM text finalizat");
  };

  const downloadExample = (type) => {
    if (type === 'csv') {
      download(CSV_EXAMPLE, "exemplu-import.csv", "text/csv");
      showToast("Exemplu CSV descărcat");
    } else {
      download(LLM_EXAMPLE, "exemplu-import-llm.txt", "text/plain");
      showToast("Exemplu LLM descărcat");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedExample(text === CSV_EXAMPLE ? 'csv' : 'llm');
      showToast("Text copiat în clipboard");
      setTimeout(() => setCopiedExample(null), 2000);
    });
  };

  // ═══════════════════════════════════
  // IMPORT
  // ═══════════════════════════════════

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      if (file.name.endsWith(".csv")) importCSV(text);
      else importLLM(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importCSV = (text) => {
    const lines = text.trim().split("\n").slice(1);
    let successCount = 0;
    let errorCount = 0;
    
    const imported = lines
      .map(line => {
        const parts = line.split(",");
        const date = parts[0]?.trim();
        const amount = parseFloat(parts[1]);
        const category = parts[2]?.trim() || "other";
        const description = (parts[4] || parts[3] || "").replace(/^"|"$/g, "").trim();
        
        if (!date || isNaN(amount) || amount <= 0) {
          errorCount++;
          return null;
        }
        
        const catExists = categories.find(c => c.id === category);
        if (!catExists) {
          errorCount++;
          return null;
        }
        
        successCount++;
        return { id: uid(), date, amount, category, description };
      })
      .filter(e => e !== null);
    
    if (!imported.length) { 
      showToast("Nicio înregistrare validă găsită în fișier", "error"); 
      return; 
    }
    
    setExpenses(prev => [...prev, ...imported]);
    setPasteText("");
    
    if (errorCount > 0) {
      showToast(`${successCount} înregistrări importate cu succes, ${errorCount} erori (format sau categorie invalidă)`, "warning");
    } else {
      showToast(`${successCount} înregistrări importate cu succes din CSV`, "success");
    }
  };

  const importLLM = (text) => {
    let inExpenses = false;
    let successCount = 0;
    let errorCount = 0;
    const imported = [];
    
    for (const line of text.split("\n")) {
      if (line.startsWith("## Cheltuieli") || line.startsWith("## Expenses")) {
        inExpenses = true; continue;
      }
      if (line.startsWith("## ") && inExpenses) { inExpenses = false; continue; }
      if (inExpenses && line.includes("|")) {
        const parts = line.split("|").map(p => p.trim());
        const entry = {
          id: uid(),
          date: parts[0],
          amount: parseFloat(parts[1]),
          category: parts[2] || "other",
          description: parts[3] || "",
        };
        
        if (!entry.date || isNaN(entry.amount) || entry.amount <= 0) {
          errorCount++;
          continue;
        }
        
        const catExists = categories.find(c => c.id === entry.category);
        if (!catExists) {
          errorCount++;
          continue;
        }
        
        successCount++;
        imported.push(entry);
      }
    }
    
    if (!imported.length) { 
      showToast("Format nerecunoscut sau fără date valide. Verificați exemplul de format.", "error"); 
      return; 
    }
    
    setExpenses(prev => [...prev, ...imported]);
    setPasteText("");
    
    if (errorCount > 0) {
      showToast(`${successCount} înregistrări importate cu succes, ${errorCount} erori (format sau categorie invalidă)`, "warning");
    } else {
      showToast(`${successCount} înregistrări importate cu succes din text`, "success");
    }
  };

  const importPasted = () => {
    if (!pasteText.trim()) {
      showToast("Lipiți textul cu date pentru import", "error");
      return;
    }
    if (pasteText.includes("|")) importLLM(pasteText);
    else importCSV(pasteText);
  };

  if (!isLoaded) return null;

  return (
    <div className="container">
      <header>
        <div className="title-group">
          <p>Sistem de Evidență și Gestiune</p>
          <h1>{view === "sinteza" ? "Sinteză" : view === "jurnal" ? "Registru" : view === "categorii" ? "Categorii" : "Date"}</h1>
        </div>
        <div className="header-actions">
          <div className="view-switcher">
            <button className={view === "sinteza" ? "active" : ""} onClick={() => setView("sinteza")}>Dashboard</button>
            <button className={view === "jurnal" ? "active" : ""} onClick={() => setView("jurnal")}>Jurnal</button>
            <button className={view === "categorii" ? "active" : ""} onClick={() => setView("categorii")}>Categorii</button>
            <button className={view === "io" ? "active" : ""} onClick={() => setView("io")}>Date</button>
          </div>
          <button className="btn btn-ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Mod Luminos" : "Mod Întunecat"}
          </button>
        </div>
      </header>

      {/* ═══════════ DASHBOARD ═══════════ */}
      {view === "sinteza" && (
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
              <div className="card card-dashed" onClick={() => { setSalaryInput(""); setShowSalary(true); }}>
                <div className="card-plus">+</div>
                <div className="card-label">Adaugă Salariu</div>
                <div className="card-hint">Urmărește bugetul rămas</div>
              </div>
            )}
          </div>

          <div className="dashboard-content">
            <div className="card chart-area">
              <div className="card-label">Evoluție Flux Financiar (6 luni)</div>
              <div style={{ width: "100%", height: 220, marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme === "dark" ? "#818cf8" : "#4f46e5"} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={theme === "dark" ? "#818cf8" : "#4f46e5"} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)", fontWeight: 500 }} dy={10} />
                    <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                    <Tooltip
                      cursor={{ fill: theme === "dark" ? "#ffffff0a" : "#00000005" }}
                      contentStyle={{ 
                        borderRadius: "8px", 
                        border: "none", 
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
                        padding: "10px"
                      }}
                      itemStyle={{ color: theme === "dark" ? "#f8fafc" : "#1e293b", fontWeight: "bold" }}
                      formatter={(v) => [formatCurrency(v), "Total"]}
                    />
                    <Bar dataKey="total" fill="url(#barGradient)" barSize={32} radius={[6, 6, 0, 0]} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-label">Distribuție Cheltuieli — Luna Curentă</div>
              {donutData.length > 0 ? (
                <div className="donut-wrap">
                  <div className="donut-canvas">
                    <Doughnut data={donutChartData} options={donutOptions} />
                  </div>
                  <div className="donut-legend">
                    {donutData.map((d, i) => {
                      const total = donutData.reduce((s, x) => s + x.total, 0);
                      const pct = Math.round(d.total / total * 100);
                      return (
                        <div key={d.id} className="legend-item">
                          <span className="legend-swatch" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="legend-name">{d.cat?.name || d.id}</span>
                          <span className="legend-pct">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-donut">Nicio cheltuială luna aceasta.</div>
              )}
            </div>
          </div>

          <div className="dashboard-bottom">
            <div className="card recent-entries">
              <div className="card-label">Ultimele 5 Tranzacții</div>
              <div className="mini-ledger">
                {expenses.slice(0, 5).map(e => (
                  <div key={e.id} className="mini-row">
                    <span className="desc">{e.description || "Fără descriere"}</span>
                    <span className="amt">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
                {expenses.length === 0 && <div className="empty-msg">Nicio tranzacție înregistrată</div>}
              </div>
              <button className="btn-text-link" onClick={() => setView("jurnal")}>Deschide Jurnalul Complet →</button>
            </div>

            <div className="card top-cat-card">
              <div className="card-label">Categoria Top — Luna Curentă</div>
              {topCategory ? (
                <div>
                  <div className="top-cat-badge" style={{
                    background: `${topCategory.cat?.color || "#666"}18`,
                    border: `1px solid ${topCategory.cat?.color || "#666"}44`
                  }}>
                    <span className="cat-dot" style={{ background: topCategory.cat?.color || "#666" }} />
                    <span style={{ color: topCategory.cat?.color || "#666" }}>{topCategory.cat?.name || topCategory.cat?.id}</span>
                  </div>
                  <div className="top-cat-amount">{formatCurrency(topCategory.total)}</div>
                  <div className="card-sub">cheltuită în luna curentă</div>
                </div>
              ) : (
                <div className="empty-donut">Nicio cheltuială luna aceasta.</div>
              )}
              <button
                className="btn-salary-config"
                onClick={() => { setSalaryInput(salary?.toString() || ""); setShowSalary(true); }}
              >
                {salary ? `Modifică Salariu (${formatCurrency(salary)})` : "+ Configurează Salariu"}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ═══════════ JURNAL ═══════════ */}
      {view === "jurnal" && (
        <main className="fade-in">
          <div className="controls">
            <div className="filters">
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="all">Toate lunile</option>
                {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="all">Toate categoriile</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-main" onClick={() => { setEditingExpense(null); setShowAdd(true); }}>+ Înregistrare Nouă</button>
          </div>

          <div className="table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th className="col-date">Dată</th>
                  <th className="col-desc">Explicație Tranzacție</th>
                  <th className="col-cat">Categorie</th>
                  <th className="col-amount">Sumă</th>
                  <th className="col-actions">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => {
                  const cat = categories.find(c => c.id === exp.category);
                  return (
                    <tr key={exp.id}>
                      <td className="col-date">{exp.date}</td>
                      <td className="col-desc">{exp.description || "—"}</td>
                      <td className="col-cat">
                        <span className="cat-label">
                          <span className="cat-dot-sm" style={{ background: cat?.color || "#999" }} />
                          {cat?.name || exp.category}
                        </span>
                      </td>
                      <td className="col-amount amount-cell">{formatCurrency(exp.amount)}</td>
                      <td className="col-actions">
                        <button className="edit-btn" onClick={() => editExpense(exp)} title="Editează">✎</button>
                        <button className="del-btn" onClick={() => deleteExpense(exp.id)} title="Șterge">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && <div className="empty-msg">Nicio înregistrare găsită în arhivă.</div>}
          </div>
        </main>
      )}

      {/* ═══════════ CATEGORII ═══════════ */}
      {view === "categorii" && (
        <main className="fade-in">
          <div className="categories-section">
            <h2>Gestionare Categorii</h2>
            
            <div className="add-category-form">
              <input
                type="text"
                placeholder="Nume categorie nouă"
                value={newCategory.name}
                onChange={e => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              />
              <input
                type="color"
                value={newCategory.color}
                onChange={e => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
              />
              {editingCategory ? (
                <button className="btn btn-main" onClick={saveCategoryEdit}>Salvează modificarea</button>
              ) : (
                <button className="btn btn-main" onClick={addCategory}>+ Adaugă categorie</button>
              )}
              {editingCategory && (
                <button className="btn btn-ghost" onClick={() => { setEditingCategory(null); setNewCategory({ name: "", color: "#6366f1" }); }}>Anulează editarea</button>
              )}
            </div>

            <div className="categories-list">
              {categories.map(cat => (
                <div key={cat.id} className="category-item">
                  <div className="category-info">
                    <span className="cat-dot-lg" style={{ background: cat.color }} />
                    <div>
                      <div className="category-name">{cat.name}</div>
                      <div className="category-id">ID: {cat.id}</div>
                    </div>
                  </div>
                  <div className="category-actions">
                    <span className="category-count">{expenses.filter(e => e.category === cat.id).length} tranzacții</span>
                    <button className="btn-ghost-sm" onClick={() => editCategory(cat.id)}>Editează</button>
                    {cat.id !== "other" && <button className="btn-ghost-sm delete" onClick={() => deleteCategory(cat.id)}>Șterge</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ═══════════ IMPORT / EXPORT ═══════════ */}
      {view === "io" && (
        <main className="fade-in">
          <div className="io-section">
            <div className="io-section-label">Export Date</div>
            <div className="io-grid">
              <div className="io-card" onClick={exportCSV}>
                <div className="io-card-name">CSV</div>
                <div className="io-card-desc">Compatibil Excel / Google Sheets</div>
              </div>
              <div className="io-card" onClick={exportLLM}>
                <div className="io-card-name">Text LLM</div>
                <div className="io-card-desc">Paste în orice asistent AI</div>
              </div>
            </div>
          </div>

          <div className="io-divider" />

          <div className="io-section">
            <div className="io-section-label">Import Date</div>
            <p className="io-hint">
              Formate acceptate: <strong>CSV</strong> (coloane: dată, sumă, categorie_id, categorie_nume, descriere)
              sau <strong>Text LLM</strong> (format pipe: <code>dată | sumă | categorie_id | descriere</code>).
            </p>

            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: "none" }} />
            <button className="btn-upload" onClick={() => fileRef.current?.click()}>
              ↑ Încarcă fișier — .csv sau .txt
            </button>

            <div className="field" style={{ marginTop: 20 }}>
              <label>Lipește text direct</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={`Exemplu CSV:\n2026-04-01,7500.00,housing,"Chirie & Servicii Comunale","Chirie apartament"\n\nExemplu Text LLM:\n## Cheltuieli\n2026-04-01 | 7500.00 | housing | Chirie apartament`}
              />
            </div>
            <button className="btn btn-main" onClick={importPasted} style={{ marginTop: 8 }}>
              Importă Text
            </button>
          </div>

          <div className="io-divider" />

          <div className="io-section">
            <div className="io-section-label">Exemple pentru Import</div>

            <div className="examples-container">
              <div className="example-box">
                <div className="example-header">
                  <h4>Exemplu CSV</h4>
                  <div className="example-actions">
                    <button className="btn-ghost-sm" onClick={() => copyToClipboard(CSV_EXAMPLE)}>
                      {copiedExample === 'csv' ? '✓ Copiat' : 'Copiază text'}
                    </button>
                    <button className="btn-ghost-sm" onClick={() => downloadExample('csv')}>
                      ↓ Descarcă
                    </button>
                  </div>
                </div>
                <pre className="example-code">{CSV_EXAMPLE}</pre>
              </div>

              <div className="example-box">
                <div className="example-header">
                  <h4>Exemplu Text LLM (Pipe Format)</h4>
                  <div className="example-actions">
                    <button className="btn-ghost-sm" onClick={() => copyToClipboard(LLM_EXAMPLE)}>
                      {copiedExample === 'llm' ? '✓ Copiat' : 'Copiază text'}
                    </button>
                    <button className="btn-ghost-sm" onClick={() => downloadExample('llm')}>
                      ↓ Descarcă
                    </button>
                  </div>
                </div>
                <pre className="example-code">{LLM_EXAMPLE}</pre>
              </div>
            </div>
          </div>

          <div className="io-divider" />

          <div className="io-stats-grid">
            {[
              ["Înregistrări", expenses.length],
              ["Categorii", categories.length],
              ["Luni", uniqueMonths],
              ["Total", formatCurrency(totalAll)],
            ].map(([label, val]) => (
              <div key={label} className="card">
                <div className="card-label">{label}</div>
                <div className="card-value" style={{ fontSize: 22 }}>{val}</div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-box">
            <h2 className="serif-header">{editingExpense ? 'Editare Tranzacție' : 'Formular Înregistrare'}</h2>
            <div className="field">
              <label>Data</label>
              <input type="date" value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Sumă (MDL)</label>
              <input type="number" placeholder="0.00" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Categorie</label>
              <select value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Descriere Detaliată</label>
              <input type="text" placeholder="Ex: Chitanță utilități Aprilie" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-main" style={{ flex: 1 }} onClick={editingExpense ? saveEditExpense : addExpense}>
                {editingExpense ? 'Salvează modificările' : 'Confirmă'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setEditingExpense(null); }}>Anulează</button>
            </div>
          </div>
        </div>
      )}

      {showSalary && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSalary(false)}>
          <div className="modal-box">
            <h2 className="serif-header">Configurare Salariu</h2>
            <div className="field">
              <label>Salariu Lunar Net (MDL)</label>
              <input
                type="number"
                placeholder="Ex: 18000"
                value={salaryInput}
                onChange={e => setSalaryInput(e.target.value)}
                autoFocus
              />
            </div>
            <p className="salary-hint">Opțional. Permite calcularea bugetului rămas după cheltuieli.</p>
            <div className="modal-footer">
              <button className="btn btn-main" style={{ flex: 1 }} onClick={saveSalary}>Salvează</button>
              <button className="btn btn-ghost" onClick={() => setShowSalary(false)}>Anulează</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast-alert toast-${toastType}`}>
          <span className="toast-icon">
            {toastType === 'success' ? '✓' : toastType === 'error' ? '✕' : '⚠'}
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}