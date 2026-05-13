import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip as CJTooltip, Legend } from "chart.js";
import { apiFetch } from "./api/client.js";
import LoginScreen from "./components/LoginScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Jurnal from "./components/Jurnal.jsx";
import Categorii from "./components/Categorii.jsx";
import DateView from "./components/Date.jsx";
import "./App.css";

ChartJS.register(ArcElement, CJTooltip, Legend);

const VALID_CATEGORIES = ["food", "transport", "housing", "utilities", "health", "entertainment", "shopping", "education", "other"];

const sanitizeStr = (str) => {
  if (!str) return "";
  return String(str).trim().replace(/"/g, "'").replace(/\\/g, "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").slice(0, 100);
};
const sanitizeCat = (cat) => {
  if (!cat) return "other";
  const c = String(cat).trim().toLowerCase();
  return VALID_CATEGORIES.includes(c) ? c : "other";
};
const sanitizeAmount = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const cleaned = String(val).replace(/\s/g, "").replace(/[^\d.,\-]/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
};
const sanitizeDate = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

export default function App() {
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("sinteza");

  const [token, setToken]               = useState(null);
  const [tokenExp, setTokenExp]         = useState(null);
  const [permissions, setPermissions]   = useState([]);
  const [apiError, setApiError]         = useState(null);
  const [loading, setLoading]           = useState(false);

  const can = useCallback((perm) => permissions.includes(perm), [permissions]);

  const [expenses, setExpenses]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [salary, setSalary]             = useState(null);
  const [stats, setStats]               = useState(null);
  const [pagination, setPagination]     = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [filterCat, setFilterCat]       = useState("all");
  const [filterMonth, setFilterMonth]   = useState("all");
  const [sortOrder, setSortOrder]       = useState("date_desc");

  const [showAdd, setShowAdd]           = useState(false);
  const [showSalary, setShowSalary]     = useState(false);
  const [editingExp, setEditingExp]     = useState(null);
  const [editingCat, setEditingCat]     = useState(null);
  const [salaryInput, setSalaryInput]   = useState("");
  const [newExp, setNewExp]             = useState({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
  const [newCategory, setNewCategory]   = useState({ name: "", color: "#6366f1" });
  const [toast, setToast]               = useState(null);
  const [toastType, setToastType]       = useState("success");
  const [countdown, setCountdown]       = useState(null);

  useEffect(() => {
    document.body.className = theme === "dark" ? "dark-theme" : "";
  }, [theme]);

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const formatCurrency = (v) => Number(v).toLocaleString("ro-MD", { minimumFractionDigits: 2 }) + " MDL";

  useEffect(() => {
    if (!tokenExp) return;
    const iv = setInterval(() => {
      const left = Math.round((tokenExp - Date.now()) / 1000);
      if (left <= 0) {
        setCountdown(0);
        setToken(null);
        setTokenExp(null);
        setPermissions([]);
        showToast("Token expirat", "error");
        clearInterval(iv);
      } else {
        setCountdown(left);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [tokenExp, showToast]);

  // ── fetchAll accepta perms optional ca sa evitam stale closure la primul login ──
  const fetchAll = useCallback(async (pg = 1, permsOverride = null) => {
    if (!token) return;
    const activePerms = permsOverride ?? permissions;  // ← fix principal
    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({ page: pg, limit: 20, sort: sortOrder });
      if (filterCat !== "all") params.set("category", filterCat);
      if (filterMonth !== "all") params.set("month", filterMonth);

      const [expData, catData, salData] = await Promise.all([
        apiFetch(`/expenses?${params}`, {}, token),
        apiFetch("/categories?limit=100", {}, token),
        apiFetch("/salary", {}, token),
      ]);
      setExpenses(expData.data);
      setPagination(expData.pagination);
      setCategories(catData.data);
      setSalary(salData.amount);

      if (activePerms.includes("ANALYZE")) {
        const statData = await apiFetch("/stats", {}, token);
        setStats(statData);
      } else {
        setStats(null);
      }
    } catch (e) {
      setApiError(e.message);
      if (e.message.includes("expired") || e.message.includes("Invalid token")) {
        setToken(null);
        setTokenExp(null);
        setPermissions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, filterCat, filterMonth, sortOrder, permissions]);

  useEffect(() => {
    fetchAll(1);
  }, [fetchAll]);

  // ── handleLogin paseaza perms direct la fetchAll ca sa nu citeasca state-ul vechi ──
  const handleLogin = (tok, expiresIn, perms) => {
    setToken(tok);
    setTokenExp(Date.now() + expiresIn * 1000);
    setPermissions(perms);
    setCountdown(expiresIn);
    showToast(`Conectat cu: ${perms.join(", ")}`);
    // Nu apelam fetchAll aici — useEffect pe [fetchAll] se va declanса automat
    // cand token-ul se seteaza, cu permisiunile corecte din closure-ul nou
  };

  const handleLogout = () => {
    setToken(null);
    setTokenExp(null);
    setPermissions([]);
    setExpenses([]);
    setCategories([]);
    setSalary(null);
    setStats(null);
  };

  const monthsList = useMemo(() => {
    if (!stats?.byMonth) return [];
    return Object.keys(stats.byMonth).sort().reverse();
  }, [stats]);

  // Expense CRUD
  const addExpense = async () => {
    if (!newExp.amount || isNaN(+newExp.amount) || +newExp.amount <= 0)
      return showToast("Introduceti o suma valida", "error");
    try {
      setLoading(true);
      await apiFetch("/expenses", { method: "POST", body: JSON.stringify({ ...newExp, amount: +newExp.amount }) }, token);
      setShowAdd(false);
      setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
      await fetchAll(1);
      showToast("Tranzactie adaugata");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const startEdit = (exp) => {
    setEditingExp(exp.id);
    setNewExp({ date: exp.date, amount: exp.amount.toString(), category: exp.category, description: exp.description });
    setShowAdd(true);
  };

  const saveEdit = async () => {
    if (!newExp.amount || isNaN(+newExp.amount) || +newExp.amount <= 0)
      return showToast("Introduceti o suma valida", "error");
    try {
      setLoading(true);
      await apiFetch(`/expenses/${editingExp}`, { method: "PUT", body: JSON.stringify({ ...newExp, amount: +newExp.amount }) }, token);
      setShowAdd(false);
      setEditingExp(null);
      setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
      await fetchAll(pagination.page);
      showToast("Tranzactie actualizata");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Sigur stergeti aceasta tranzactie?")) return;
    try {
      setLoading(true);
      await apiFetch(`/expenses/${id}`, { method: "DELETE" }, token);
      await fetchAll(pagination.page);
      showToast("Tranzactie stearsa");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  // Category CRUD
  const addCategory = async () => {
    if (!newCategory.name.trim()) return showToast("Numele categoriei este obligatoriu", "error");
    try {
      setLoading(true);
      await apiFetch("/categories", { method: "POST", body: JSON.stringify(newCategory) }, token);
      setNewCategory({ name: "", color: "#6366f1" });
      await fetchAll(1);
      showToast("Categorie adaugata");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const startEditCat = (cat) => { setEditingCat(cat.id); setNewCategory({ name: cat.name, color: cat.color }); };

  const saveEditCat = async () => {
    if (!newCategory.name.trim()) return showToast("Numele este obligatoriu", "error");
    try {
      setLoading(true);
      await apiFetch(`/categories/${editingCat}`, { method: "PUT", body: JSON.stringify(newCategory) }, token);
      setEditingCat(null);
      setNewCategory({ name: "", color: "#6366f1" });
      await fetchAll(1);
      showToast("Categorie actualizata");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const deleteCategory = async (id) => {
    if (id === "other") return showToast("Categoria 'Diverse' nu poate fi stearsa", "error");
    if (!window.confirm("Sigur stergeti aceasta categorie?")) return;
    try {
      setLoading(true);
      await apiFetch(`/categories/${id}`, { method: "DELETE" }, token);
      await fetchAll(1);
      showToast("Categorie stearsa");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  // Salary
  const saveSalary = async () => {
    const v = salaryInput === "" ? null : +salaryInput;
    if (v !== null && (isNaN(v) || v < 0)) return showToast("Salariu invalid", "error");
    try {
      setLoading(true);
      await apiFetch("/salary", { method: "PUT", body: JSON.stringify({ amount: v }) }, token);
      setShowSalary(false);
      await fetchAll(1);
      showToast(v !== null ? "Salariu configurat" : "Salariu eliminat");
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  // Import
  const handleImport = useCallback(async (rows) => {
    if (!rows || !rows.length) { showToast("Nu exista date de importat", "error"); return; }
    setLoading(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const row of rows) {
      const date = sanitizeDate(row.date);
      const amount = sanitizeAmount(row.amount);
      const category = sanitizeCat(row.category);
      const description = sanitizeStr(row.description);
      if (!date || !amount) { skipped++; continue; }
      try {
        await apiFetch("/expenses", { method: "POST", body: JSON.stringify({ date, amount, category, description }) }, token);
        ok++;
      } catch {
        try {
          await apiFetch("/expenses", { method: "POST", body: JSON.stringify({ date, amount, category, description: "" }) }, token);
          ok++;
        } catch { fail++; }
      }
    }
    await fetchAll(1);
    if (fail === 0 && skipped === 0) {
      showToast(`${ok} inregistrari importate cu succes`, "success");
    } else {
      let msg = "";
      if (ok > 0) msg += `${ok} importate. `;
      if (fail > 0) msg += `${fail} esuate. `;
      if (skipped > 0) msg += `${skipped} sarite.`;
      showToast(msg.trim(), fail > 0 ? "error" : "success");
    }
    setLoading(false);
  }, [token, fetchAll, showToast]);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const PERM_COLORS = { READ: "#378ADD", WRITE: "#1D9E75", DELETE: "#D85A30", ANALYZE: "#7F77DD" };

  return (
    <div className="container">
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "var(--accent)", zIndex: 2000 }} />
      )}

      <header>
        <div className="title-group">
          <p>Sistem de Evidenta si Gestiune</p>
          <h1>{view === "sinteza" ? "Sinteza" : view === "jurnal" ? "Registru" : view === "categorii" ? "Categorii" : "Date"}</h1>
        </div>
        <div className="header-actions">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: countdown > 15 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${countdown > 15 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              <span style={{ color: countdown > 15 ? "#10b981" : "#ef4444" }}>{countdown}s</span>
              <span style={{ color: "var(--muted)", margin: "0 2px" }}>·</span>
              {permissions.map(p => (
                <span key={p} style={{ color: PERM_COLORS[p], fontFamily: "monospace", fontSize: 10 }}>{p}</span>
              ))}
              <button onClick={handleLogout}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, marginLeft: 2 }}>×</button>
            </div>

            <div className="view-switcher">
              {["sinteza", "jurnal", "categorii", "io"].map(v => (
                <button
                  key={v}
                  className={view === v ? "active" : ""}
                  onClick={() => setView(v)}
                  disabled={v === "sinteza" && !can("ANALYZE")}
                  title={v === "sinteza" && !can("ANALYZE") ? "Necesita permisiunea ANALYZE" : ""}
                  style={{ opacity: v === "sinteza" && !can("ANALYZE") ? 0.4 : 1 }}
                >
                  {v === "sinteza" ? "Dashboard" : v === "jurnal" ? "Jurnal" : v === "categorii" ? "Categorii" : "Date"}
                </button>
              ))}
            </div>

            <button className="btn btn-ghost" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      {apiError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "12px 16px", marginBottom: 20, color: "#ef4444", fontSize: 13 }}>
          {apiError}
          <button onClick={() => fetchAll(1)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", marginLeft: 10 }}>reincearca</button>
        </div>
      )}

      {view === "sinteza" && (
        can("ANALYZE") ? (
          <Dashboard
            stats={stats}
            categories={categories}
            expenses={expenses}
            salary={salary}
            theme={theme}
            formatCurrency={formatCurrency}
            onSetView={setView}
            onConfigureSalary={() => { setSalaryInput(salary?.toString() || ""); setShowSalary(true); }}
            canWrite={can("WRITE")}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Permisiunea ANALYZE necesara</div>
            <div style={{ fontSize: 13 }}>Dashboard-ul si statisticile sunt disponibile doar cu permisiunea ANALYZE.</div>
          </div>
        )
      )}

      {view === "jurnal" && (
        <Jurnal
          expenses={expenses}
          categories={categories}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          monthsList={monthsList}
          pagination={pagination}
          formatCurrency={formatCurrency}
          onAdd={can("WRITE") ? () => { setEditingExp(null); setShowAdd(true); } : null}
          onEdit={can("WRITE") ? startEdit : null}
          onDelete={can("DELETE") ? deleteExpense : null}
          fetchAll={fetchAll}
        />
      )}

      {view === "categorii" && (
        <Categorii
          categories={categories}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          editingCat={editingCat}
          onAddCategory={can("WRITE") ? addCategory : null}
          onEditCategory={can("WRITE") ? startEditCat : null}
          onSaveEditCategory={saveEditCat}
          onCancelEdit={() => { setEditingCat(null); setNewCategory({ name: "", color: "#6366f1" }); }}
          onDeleteCategory={can("DELETE") ? deleteCategory : null}
          canWrite={can("WRITE")}
          canDelete={can("DELETE")}
        />
      )}

      {view === "io" && (
        <DateView
          token={token}
          permissions={permissions}
          countdown={countdown}
          stats={stats}
          categories={categories}
          expenses={expenses}
          formatCurrency={formatCurrency}
          showToast={showToast}
          onLogout={handleLogout}
          onImport={can("WRITE") ? handleImport : null}
          canAnalyze={can("ANALYZE")}
          canWrite={can("WRITE")}
        />
      )}

      {showAdd && can("WRITE") && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-box">
            <h2 className="serif-header">{editingExp ? "Editare Tranzactie" : "Formular Inregistrare"}</h2>
            <div className="field">
              <label>Data</label>
              <input type="date" value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Suma (MDL)</label>
              <input type="number" placeholder="0.00" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Categorie</label>
              <select value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Descriere</label>
              <input type="text" placeholder="Detalii" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-main" style={{ flex: 1 }} onClick={editingExp ? saveEdit : addExpense} disabled={loading}>
                {loading ? "Se salveaza..." : editingExp ? "Salveaza" : "Confirma"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setEditingExp(null); }}>Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      {showSalary && can("WRITE") && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSalary(false)}>
          <div className="modal-box">
            <h2 className="serif-header">Configurare Salariu</h2>
            <div className="field">
              <label>Salariu Lunar Net (MDL)</label>
              <input type="number" placeholder="Ex: 18000" value={salaryInput} onChange={e => setSalaryInput(e.target.value)} autoFocus />
            </div>
            <p className="salary-hint">Lasa gol pentru a elimina urmarirea salariului.</p>
            <div className="modal-footer">
              <button className="btn btn-main" style={{ flex: 1 }} onClick={saveSalary} disabled={loading}>Salveaza</button>
              <button className="btn btn-ghost" onClick={() => setShowSalary(false)}>Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast-alert toast-${toastType}`}>
          <span className="toast-icon">{toastType === "success" ? "OK" : toastType === "error" ? "ERR" : "WARN"}</span>
          {toast}
        </div>
      )}
    </div>
  );
}