import { useState, useEffect, useMemo } from "react";
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
  
  const months = useMemo(() => [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse(), [expenses]);

  const filtered = useMemo(() => {
    let list = [...expenses];
    if (filterCat !== "all") list = list.filter(e => e.category === filterCat);
    if (filterMonth !== "all") list = list.filter(e => e.date.slice(0, 7) === filterMonth);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filterCat, filterMonth]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const formatCurrency = (val) => val.toLocaleString('ro-MD', { minimumFractionDigits: 2 }) + " MDL";

  const addExpense = () => {
    if (!newExp.amount || isNaN(+newExp.amount)) return;
    setExpenses(p => [{ ...newExp, id: uid(), amount: +newExp.amount }, ...p]);
    setShowAdd(false);
    setNewExp({ date: new Date().toISOString().slice(0, 10), amount: "", category: "food", description: "" });
    showToast("Tranzacție înregistrată");
  };

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

      <div className="summary-grid">
        <div className="card">
          <div className="card-label">Total Filtru</div>
          <div className="card-value" style={{color: "var(--accent)"}}>{formatCurrency(total)}</div>
        </div>
        <div className="card">
          <div className="card-label">Rulaj Total</div>
          <div className="card-value">{formatCurrency(expenses.reduce((s,e)=>s+e.amount,0))}</div>
        </div>
        <div className="card">
          <div className="card-label">Înregistrări</div>
          <div className="card-value">{expenses.length}</div>
        </div>
      </div>

      <div className="controls">
        <div style={{display:'flex', gap:'12px'}}>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            <option value="all">Toate lunile</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">Toate categoriile</option>
            {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-main" onClick={() => setShowAdd(true)}>+ Adaugă Tranzacție</button>
      </div>

      <table className="ledger-table">
        <thead>
          <tr>
            <th className="col-date">Dată</th>
            <th className="col-desc">Descriere</th>
            <th className="col-cat">Categorie</th>
            <th className="col-amount">Sumă</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(exp => {
            const cat = DEFAULT_CATEGORIES.find(c => c.id === exp.category);
            return (
              <tr key={exp.id}>
                <td className="col-date">{exp.date}</td>
                <td className="col-desc" title={exp.description}>{exp.description || "—"}</td>
                <td className="col-cat" style={{color: "var(--muted)"}}>{cat?.name}</td>
                <td className="col-amount amount-cell">{formatCurrency(exp.amount)}</td>
                <td className="col-actions">
                  <button 
                    onClick={() => setExpenses(p => p.filter(e => e.id !== exp.id))} 
                    style={{background:'none', border:'none', color: 'var(--muted)', cursor:'pointer', fontSize:'20px'}}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div style={{
          textAlign:'center', 
          padding: '80px', 
          border: '1px solid var(--border)', 
          borderTop: 'none', 
          color: 'var(--muted)', 
          fontStyle: 'italic'
        }}>
          Nu sunt date disponibile pentru selecția curentă.
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content">
            <h2 style={{fontFamily:'Playfair Display', marginBottom:'25px', fontSize:'28px'}}>Tranzacție Nouă</h2>
            <div className="form-field">
              <label>Data</label>
              <input type="date" value={newExp.date} onChange={e => setNewExp(p=>({...p, date: e.target.value}))} />
            </div>
            <div className="form-field">
              <label>Suma (MDL)</label>
              <input type="number" placeholder="0.00" value={newExp.amount} onChange={e => setNewExp(p=>({...p, amount: e.target.value}))} />
            </div>
            <div className="form-field">
              <label>Categorie</label>
              <select value={newExp.category} onChange={e => setNewExp(p=>({...p, category: e.target.value}))}>
                {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Descriere</label>
              <input type="text" placeholder="Ex: Factură Orange..." value={newExp.description} onChange={e => setNewExp(p=>({...p, description: e.target.value}))} />
            </div>
            <div style={{display:'flex', gap: '12px', marginTop: '30px'}}>
              <button className="btn btn-main" style={{flex: 1}} onClick={addExpense}>Înregistrează</button>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Anulează</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION - ADAUGAT LA COMMIT 8 */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}