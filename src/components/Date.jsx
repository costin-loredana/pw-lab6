import React, { useRef, useState } from "react";

export default function DateView({ token, tokenRole, countdown, stats, categories, expenses, formatCurrency, showToast, onLogout }) {
  const fileRef = useRef();
  const [pasteText, setPasteText] = useState("");
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [copiedLLM, setCopiedLLM] = useState(false);

  const API_BASE = "http://localhost:3001";

  const download = (content, filename, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };

  const exportCSV = () => {
    const header = ["Data", "Suma (MDL)", "Categorie ID", "Categorie Nume", "Descriere"];
    const rows = expenses.map(e => {
      const cat = categories.find(c => c.id === e.category);
      return [e.date, e.amount.toFixed(2), e.category, `"${cat?.name || e.category}"`, `"${e.description || ""}"`];
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
      "# Registru Cheltuieli - Export Text",
      `Generat: ${new Date().toLocaleString("ro-RO")}`,
      `Total inregistrari: ${expenses.length}`,
      "",
      "## Categorii",
      ...categories.map(c => `- [${c.id}] ${c.name}`),
      "",
      "## Cheltuieli (data | suma MDL | categorie_id | descriere)",
      ...expenses.map(e => `${e.date} | ${e.amount.toFixed(2)} | ${e.category} | ${e.description || ""}`),
      "",
      "## Sumar Lunar",
      ...Object.entries(monthStats).sort(([a], [b]) => b.localeCompare(a)).map(([m, d]) => `${m}: ${d.total.toFixed(2)} MDL (${d.count} inregistrari)`),
    ];
    download(lines.join("\n"), "registru-cheltuieli-llm.txt", "text/plain");
    showToast("Export LLM text finalizat");
  };

  const CSV_EXAMPLE = `Data,Suma (MDL),Categorie ID,Categorie Nume,Descriere
2026-04-01,7500.00,housing,"Chirie & Servicii Comunale","Chirie apartament Aprilie"
2026-04-05,485.50,food,"Alimentatie & Produse","Cumparaturi saptamanale"
2026-04-10,120.00,transport,"Transport & Combustibil","Alimentare combustibil"
2026-04-12,320.00,health,"Sanatate & Farmacie","Consultatie medicala"
2026-04-18,210.00,entertainment,"Timp Liber & Cultura","Cinema & restaurant"`;

  const LLM_EXAMPLE = `# Registru Cheltuieli - Export Text
Generat: ${new Date().toLocaleString("ro-RO")}
Total inregistrari: 5

## Categorii
- [food] Alimentatie & Produse
- [transport] Transport & Combustibil
- [housing] Chirie & Servicii Comunale
- [health] Sanatate & Farmacie
- [entertainment] Timp Liber & Cultura

## Cheltuieli (data | suma MDL | categorie_id | descriere)
2026-04-01 | 7500.00 | housing | Chirie apartament Aprilie
2026-04-05 | 485.50 | food | Cumparaturi saptamanale
2026-04-10 | 120.00 | transport | Alimentare combustibil
2026-04-12 | 320.00 | health | Consultatie medicala
2026-04-18 | 210.00 | entertainment | Cinema & restaurant

## Sumar Lunar
2026-04: 8635.50 MDL (5 inregistrari)`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "csv") {
        setCopiedCSV(true);
        setTimeout(() => setCopiedCSV(false), 2000);
      } else {
        setCopiedLLM(true);
        setTimeout(() => setCopiedLLM(false), 2000);
      }
      showToast("Text copiat in clipboard");
    });
  };

  const downloadExample = (type) => {
    if (type === "csv") {
      download(CSV_EXAMPLE, "exemplu-import.csv", "text/csv");
    } else {
      download(LLM_EXAMPLE, "exemplu-import-llm.txt", "text/plain");
    }
    showToast(`Exemplu ${type.toUpperCase()} descarcat`);
  };

  return (
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
            <div className="io-card-desc">Paste in orice asistent AI</div>
          </div>
        </div>
      </div>

      <div className="io-divider" />

      <div className="io-section">
        <div className="io-section-label">Import Date</div>
        <p className="io-hint">
          Formate acceptate: <strong>CSV</strong> (coloane: data, suma, categorie_id, categorie_nume, descriere)
          sau <strong>Text LLM</strong> (format pipe: <code>data | suma | categorie_id | descriere</code>).
        </p>

        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} />
        <button className="btn-upload" onClick={() => fileRef.current?.click()}>
          Incarca fisier - .csv sau .txt
        </button>

        <div className="field" style={{ marginTop: 20 }}>
          <label>Sau lipeste text direct</label>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`Exemplu CSV:\n2026-04-01,7500.00,housing,"Chirie","Chirie apartament"\n\nExemplu Text LLM:\n## Cheltuieli\n2026-04-01 | 7500.00 | housing | Chirie apartament`}
          />
        </div>
      </div>

      <div className="io-divider" />

      <div className="io-section">
        <div className="io-section-label">Exemple pentru Import</div>
        <p className="io-hint">Descarcati sau copiati exemple pentru a intelege formatul corect de import.</p>

        <div className="examples-container">
          <div className="example-box">
            <div className="example-header">
              <h4>Exemplu CSV</h4>
              <div className="example-actions">
                <button className="btn-ghost-sm" onClick={() => copyToClipboard(CSV_EXAMPLE, "csv")}>
                  {copiedCSV ? "Copiat" : "Copiaza text"}
                </button>
                <button className="btn-ghost-sm" onClick={() => downloadExample("csv")}>
                  Descarca
                </button>
              </div>
            </div>
            <pre className="example-code">{CSV_EXAMPLE}</pre>
          </div>

          <div className="example-box">
            <div className="example-header">
              <h4>Exemplu Text LLM (Pipe Format)</h4>
              <div className="example-actions">
                <button className="btn-ghost-sm" onClick={() => copyToClipboard(LLM_EXAMPLE, "llm")}>
                  {copiedLLM ? "Copiat" : "Copiaza text"}
                </button>
                <button className="btn-ghost-sm" onClick={() => downloadExample("llm")}>
                  Descarca
                </button>
              </div>
            </div>
            <pre className="example-code">{LLM_EXAMPLE}</pre>
          </div>
        </div>
      </div>

      <div className="io-divider" />

      <div className="io-section">
        <div className="io-section-label">API Info</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            {[
              ["Base URL", API_BASE],
              ["Swagger UI", "localhost:3001/docs"],
              ["Token Endpoint", "POST /token"],
              ["Token Expiry", "60 seconds (demo)"],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="card-label">{label}</div>
                <code style={{ fontSize: 13, color: "var(--accent)" }}>{val}</code>
              </div>
            ))}
          </div>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="btn btn-main" style={{ display: "inline-block", textDecoration: "none", padding: "12px 24px" }}>
            Open Swagger UI
          </a>
        </div>

        <div className="io-section-label">Current Token</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: countdown > 15 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
              {countdown > 0 ? `Expires in ${countdown}s` : "Expired"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Role: <strong>{tokenRole}</strong></span>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", wordBreak: "break-all", background: "var(--stripe)", padding: "10px 14px", borderRadius: 4 }}>
            {token}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onLogout}>
            Logout / Get new token
          </button>
        </div>
      </div>

      <div className="io-divider" />

      <div className="io-stats-grid">
        {[
          ["Inregistrari", stats?.totalExpenses || 0],
          ["Categorii", categories.length],
          ["Luni", Object.keys(stats?.byMonth || {}).length],
          ["Total", formatCurrency(stats?.totalAmount || 0)],
        ].map(([label, val]) => (
          <div key={label} className="card">
            <div className="card-label">{label}</div>
            <div className="card-value" style={{ fontSize: 22 }}>{val}</div>
          </div>
        ))}
      </div>
    </main>
  );
}