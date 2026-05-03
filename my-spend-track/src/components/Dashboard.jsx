import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Doughnut } from "react-chartjs-2";

const DONUT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

export default function Dashboard({ stats, categories, expenses, salary, theme, formatCurrency, onSetView, onConfigureSalary }) {
  const curMonth = new Date().toISOString().slice(0, 7);
  const curMonthTotal = stats?.currentMonth?.total || 0;
  const salaryPct = salary ? Math.min(100, Math.round(curMonthTotal / salary * 100)) : null;
  const remaining = salary !== null ? salary - curMonthTotal : null;

  const donutData = useMemo(() => {
    if (!stats?.byCategory) return [];
    return Object.entries(stats.byCategory)
      .map(([id, total]) => ({ id, total, cat: categories.find(c => c.id === id) }))
      .sort((a, b) => b.total - a.total);
  }, [stats, categories]);

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
      tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` } },
    },
  };

  const chartData = useMemo(() => {
    if (!stats?.byMonth) return [];
    return Object.entries(stats.byMonth)
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        const label = new Date(+y, +m - 1).toLocaleDateString("ro-RO", { month: "short" }) + ` '${y.slice(2)}`;
        return { label, total: val, rawDate: key };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-6);
  }, [stats]);

  const topCategory = useMemo(() => {
    if (!stats?.byCategory) return null;
    const entries = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const [id, total] = entries[0];
    return { cat: categories.find(c => c.id === id), total };
  }, [stats, categories]);

  return (
    <main className="fade-in">
      <div className="summary-grid">
        <div className="card highlight">
          <div className="card-label">Total Cheltuieli</div>
          <div className="card-value">{formatCurrency(stats?.totalAmount || 0)}</div>
          <div className="card-sub">{stats?.totalExpenses || 0} tranzactii</div>
        </div>
        <div className="card">
          <div className="card-label">Luna Curenta</div>
          <div className="card-value">{formatCurrency(curMonthTotal)}</div>
          {salaryPct !== null && (
            <>
              <div className="card-sub">{salaryPct}% din salariu</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${salaryPct}%`,
                  background: salaryPct > 90 ? "#ef4444" : salaryPct > 70 ? "#f59e0b" : "#10b981"
                }} />
              </div>
            </>
          )}
        </div>
        {salary !== null ? (
          <div className="card salary-card">
            <div className="card-label">Buget Ramas</div>
            <div className="card-value" style={{ color: remaining < 0 ? "#ef4444" : remaining < salary * 0.2 ? "#f59e0b" : "inherit" }}>
              {formatCurrency(remaining)}
            </div>
            <div className="card-sub">din {formatCurrency(salary)} salariu</div>
          </div>
        ) : (
          <div className="card card-dashed" onClick={onConfigureSalary}>
            <div className="card-plus">+</div>
            <div className="card-label">Adauga Salariu</div>
            <div className="card-hint">Urmareste bugetul ramas</div>
          </div>
        )}
      </div>

      <div className="dashboard-content">
        <div className="card chart-area">
          <div className="card-label">Evolutie Flux Financiar (6 luni)</div>
          <div style={{ width: "100%", height: 220, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === "dark" ? "#818cf8" : "#4f46e5"} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={theme === "dark" ? "#818cf8" : "#4f46e5"} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#334155" : "#e2e8f0"} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)", fontWeight: 500 }} dy={10} />
                <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip
                  cursor={{ fill: theme === "dark" ? "#ffffff0a" : "#00000005" }}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff", padding: "10px" }}
                  itemStyle={{ color: theme === "dark" ? "#f8fafc" : "#1e293b", fontWeight: "bold" }}
                  formatter={(v) => [formatCurrency(v), "Total"]}
                />
                <Bar dataKey="total" fill="url(#barGradient)" barSize={32} radius={[6, 6, 0, 0]} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-label">Distributie - Luna Curenta</div>
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
            <div className="empty-donut">Nicio cheltuiala luna aceasta.</div>
          )}
        </div>
      </div>

      <div className="dashboard-bottom">
        <div className="card recent-entries">
          <div className="card-label">Ultimele 5 Tranzactii</div>
          <div className="mini-ledger">
            {expenses.slice(0, 5).map(e => (
              <div key={e.id} className="mini-row">
                <span className="desc">{e.description || "Fara descriere"}</span>
                <span className="amt">{formatCurrency(e.amount)}</span>
              </div>
            ))}
            {expenses.length === 0 && <div className="empty-msg">Nicio tranzactie inregistrata</div>}
          </div>
          <button className="btn-text-link" onClick={() => onSetView("jurnal")}>Deschide Jurnalul Complet</button>
        </div>

        <div className="card top-cat-card">
          <div className="card-label">Categoria Top - Luna Curenta</div>
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
              <div className="card-sub">cheltuita in luna curenta</div>
            </div>
          ) : (
            <div className="empty-donut">Nicio cheltuiala luna aceasta.</div>
          )}
          <button className="btn-salary-config" onClick={onConfigureSalary}>
            {salary !== null ? `Modifica Salariu (${formatCurrency(salary)})` : "+ Configureaza Salariu"}
          </button>
        </div>
      </div>
    </main>
  );
}