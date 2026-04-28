import React, { useState, useEffect, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Chart as ChartJS, ArcElement, Tooltip as CJTooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import "./App.css";

ChartJS.register(ArcElement, CJTooltip, Legend);

const STORAGE_KEY = "registru_finante_editorial_v3";

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

const SAMPLE_DATA = [
  { id: "1", date: "2026-03-15", amount: 1200.00, category: "shopping", description: "Monitor nou" },
  { id: "2", date: "2026-04-01", amount: 7500.00, category: "housing", description: "Chirie apartament" },
  { id: "3", date: "2026-04-05", amount: 485.50, category: "food", description: "Cumpărături săptămânale" },
  { id: "4", date: "2026-04-10", amount: 120.00, category: "transport", description: "Alimentare rezervor" },
  { id: "5", date: "2026-04-12", amount: 320.00, category: "health", description: "Consultație + medicamente" },
  { id: "6", date: "2026-04-18", amount: 210.00, category: "entertainment", description: "Cinema & restaurant" },
  { id: "7", date: "2026-03-28", amount: 890.00, category: "food", description: "Cumpărături lunare" },
  { id: "8", date: "2026-03-20", amount: 450.00, category: "transport", description: "Revizie mașină" },
];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("sinteza");
  const [expenses, setExpenses] = useState([]);
  const [salary, setSalary] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");
  const [newExp, setNewExp] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "", category: "food", description: ""
  });
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
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

  const topCategory = useMemo(() => {
    const totals = {};
    curMonthExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return null;
    const cat = DEFAULT_CATEGORIES.find(c => c.id === sorted[0][0]);
    return { cat, total: sorted[0][1] };
  }, [curMonthExpenses]);

  const donutData = useMemo(() => {
    const totals = {};
    curMonthExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([id, total]) => ({ id, total, cat: DEFAULT_CATEGORIES.find(c => c.id === id) }));
  }, [curMonthExpenses]);

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

  const addExpense = () => {
    if (!newExp.amount || isNaN(+newExp.amount)) return;
    setExpenses(prev => [{ ...newExp, id: uid(), amount: +newExp.amount }, ...prev]);
    setShowAdd(false);
    setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
    showToast("Tranzacție salvată în registru");
  };

  const saveSalary = () => {
    const v = +salaryInput;
    setSalary(v > 0 ? v : null);
    setShowSalary(false);
    showToast(v > 0 ? "Salariu configurat cu succes" : "Salariu eliminat");
  };

  // ══════════════════════════════════════════════════════════════
  // EXPORT
  // ══════════════════════════════════════════════════════════════

  const download = (content, filename, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };

  const exportCSV = () => {
    const header = ["Dată", "Sumă (MDL)", "Categorie ID", "Categorie Nume", "Descriere"];
    const rows = expenses.map(e => {
      const cat = DEFAULT_CATEGORIES.find(c => c.id === e.category);
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
      ...DEFAULT_CATEGORIES.map(c => `- [${c.id}] ${c.name}`),
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

  // ══════════════════════════════════════════════════════════════
  // IMPORT
  // ══════════════════════════════════════════════════════════════

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
    const imported = lines
      .map(line => {
        const parts = line.split(",");
        return {
          id: uid(),
          date: parts[0]?.trim(),
          amount: parseFloat(parts[1]),
          category: parts[2]?.trim() || "other",
          description: (parts[4] || parts[3] || "").replace(/^"|"$/g, "").trim(),
        };
      })
      .filter(e => e.date && !isNaN(e.amount));
    if (!imported.length) { showToast("Nicio înregistrare validă găsită în fișier"); return; }
    setExpenses(prev => [...prev, ...imported]);
    showToast(`${imported.length} înregistrări importate din CSV`);
  };

  const importLLM = (text) => {
    let inExpenses = false;
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
        if (entry.date && !isNaN(entry.amount)) imported.push(entry);
      }
    }
    if (!imported.length) { showToast("Format nerecunoscut sau fără date valide"); return; }
    setExpenses(prev => [...prev, ...imported]);
    showToast(`${imported.length} înregistrări importate din text`);
  };

  if (!isLoaded) return null;

  return (
    <div className="container">
      <header>
        <div className="title-group">
          <p>Sistem de Evidență și Gestiune</p>
          <h1>{view === "sinteza" ? "Sinteză" : view === "jurnal" ? "Registru" : "Date"}</h1>
        </div>
        <div className="header-actions">
          <div className="view-switcher">
            <button className={view === "sinteza" ? "active" : ""} onClick={() => setView("sinteza")}>Dashboard</button>
            <button className={view === "jurnal" ? "active" : ""} onClick={() => setView("jurnal")}>Jurnal</button>
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
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} dy={10} />
                    <YAxis hide domain={[0, "auto"]} />
                    <Tooltip
                      cursor={{ fill: "var(--stripe)" }}
                      contentStyle={{ borderRadius: 0, border: "1px solid var(--border)", fontFamily: "Inter" }}
                      formatter={(v) => [v.toLocaleString("ro-MD", { minimumFractionDigits: 2 }) + " MDL", "Total"]}
                    />
                    <Bar dataKey="total" fill="var(--text)" barSize={42} radius={[2, 2, 0, 0]} />
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
                {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-main" onClick={() => setShowAdd(true)}>+ Înregistrare Nouă</button>
          </div>

          <div className="table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th className="col-date">Dată</th>
                  <th className="col-desc">Explicație Tranzacție</th>
                  <th className="col-cat">Categorie</th>
                  <th className="col-amount">Sumă</th>
                  <th className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => {
                  const cat = DEFAULT_CATEGORIES.find(c => c.id === exp.category);
                  return (
                    <tr key={exp.id}>
                      <td className="col-date">{exp.date}</td>
                      <td className="col-desc">{exp.description || "—"}</td>
                      <td className="col-cat">
                        <span className="cat-label">
                          <span className="cat-dot-sm" style={{ background: cat?.color || "#999" }} />
                          {cat?.name}
                        </span>
                      </td>
                      <td className="col-amount amount-cell">{formatCurrency(exp.amount)}</td>
                      <td className="col-actions">
                        <button className="del-btn" onClick={() => setExpenses(prev => prev.filter(i => i.id !== exp.id))}>✕</button>
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

      {/* ═══════════ IMPORT / EXPORT ═══════════ */}
      {view === "io" && (
        <main className="fade-in">
          <div className="io-section">
            <div className="io-section-label">Export Date</div>
            <div className="io-grid">
              <div className="io-card" onClick={exportCSV}>
                <div className="io-icon">📊</div>
                <div className="io-card-name">CSV</div>
                <div className="io-card-desc">Excel / Google Sheets</div>
              </div>
              <div className="io-card" onClick={exportLLM}>
                <div className="io-icon">📝</div>
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
          </div>
        </main>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-box">
            <h2 className="serif-header">Formular Înregistrare</h2>
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
                {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Descriere Detaliată</label>
              <input type="text" placeholder="Ex: Chitanță utilități Aprilie" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-main" style={{ flex: 1 }} onClick={addExpense}>Confirmă</button>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Anulează</button>
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

      {toast && <div className="toast-alert">{toast}</div>}
    </div>
  );
}