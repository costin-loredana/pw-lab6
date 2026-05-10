import React, { useRef, useState } from "react";

export default function DateView({
  token, permissions, countdown, stats, categories, expenses,
  formatCurrency, showToast, onLogout, onImport, canAnalyze, canWrite,
}) {
  const fileRef = useRef();
  const [pasteText, setPasteText] = useState("");
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [copiedLLM, setCopiedLLM] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeFormat, setActiveFormat] = useState("llm");

  const API_BASE = "http://localhost:3001";

  const download = (content, filename, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  };

  const exportCSV = () => {
    if (!canAnalyze) { showToast("Necesita permisiunea ANALYZE", "error"); return; }
    const header = ["Data", "Suma (MDL)", "Categorie ID", "Descriere"];
    const rows = expenses.map(e => [
      e.date,
      e.amount.toFixed(2),
      e.category,
      `"${(e.description || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    download(csv, "registru-cheltuieli.csv", "text/csv");
    showToast("Export CSV finalizat");
  };

  const exportLLM = () => {
    if (!canAnalyze) { showToast("Necesita permisiunea ANALYZE", "error"); return; }
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

  const AI_PROMPT_CSV = `Am atasat un extras de cont bancar in format PDF.

SARCINA TA:
Extrage TOATE tranzactiile de tip DEBIT (plati, cheltuieli) din PDF si returneaza-le in format CSV.

FORMAT OUTPUT (STRICT):
data,suma,categorie_id,descriere

REGULI OBLIGATORII:
1. Extrage TOATE tranzactiile de cheltuieli (debit/iesiri), nici una in plus, nici una in minus
2. Ignora tranzactiile de credit (incasari, salarii, transferuri primite)
3. Data in format YYYY-MM-DD (ex: 2026-04-15)
4. Suma: doar cifre pozitive cu 2 zecimale, fara simbol valutar (ex: 1250.00)
5. Daca suma e in alta valuta decat MDL, converteste la MDL folosind cursul din PDF sau cursul BNM al zilei
6. Categorie: alege OBLIGATORIU din aceasta lista exacta (lowercase):
   food, transport, housing, utilities, health, entertainment, shopping, education, other
7. Mapeaza categoria dupa descrierea tranzactiei:
   - Supermarket, restaurant, cafenea, Kaufland, Linella, McDo → food
   - Benzinarie, taxi, Uber, parcare, autobuz → transport
   - Chirie, ipoteca, asociatie → housing
   - Curent, gaz, apa, internet, telefon → utilities
   - Farmacie, medic, spital, clinica → health
   - Cinema, Netflix, Spotify, jocuri, bar → entertainment
   - Haine, incaltaminte, electronice, magazin → shopping
   - Cursuri, carti, scoala, taxa → education
   - Orice altceva → other
8. Descriere: copiaza descrierea originala din extras, scurtata la max 50 caractere, fara virgule in interior
9. FARA header, FARA linii goale, FARA text explicativ, FARA marcaje de cod
10. Incepe DIRECT cu prima linie de date

RASPUNDE DOAR CU LINIILE CSV. NIMIC ALTCEVA.`;

  const AI_PROMPT_LLM = `Am atasat un extras de cont bancar in format PDF.

SARCINA TA:
Extrage TOATE tranzactiile de tip DEBIT (plati, cheltuieli) din PDF si returneaza-le in format text.

FORMAT OUTPUT (STRICT):
YYYY-MM-DD | suma | categorie_id | descriere

REGULI OBLIGATORII:
1. Extrage TOATE tranzactiile de cheltuieli (debit/iesiri), nici una in plus, nici una in minus
2. Ignora tranzactiile de credit (incasari, salarii, transferuri primite)
3. Data in format YYYY-MM-DD (ex: 2026-04-15)
4. Suma: doar cifre pozitive cu 2 zecimale, fara simbol valutar (ex: 1250.00)
5. Daca suma e in alta valuta decat MDL, converteste la MDL folosind cursul din PDF sau cursul BNM al zilei
6. Categorie: alege OBLIGATORIU din aceasta lista exacta (lowercase):
   food, transport, housing, utilities, health, entertainment, shopping, education, other
7. Mapeaza categoria dupa descrierea tranzactiei:
   - Supermarket, restaurant, cafenea, Kaufland, Linella, McDo → food
   - Benzinarie, taxi, Uber, parcare, autobuz → transport
   - Chirie, ipoteca, asociatie → housing
   - Curent, gaz, apa, internet, telefon → utilities
   - Farmacie, medic, spital, clinica → health
   - Cinema, Netflix, Spotify, jocuri, bar → entertainment
   - Haine, incaltaminte, electronice, magazin → shopping
   - Cursuri, carti, scoala, taxa → education
   - Orice altceva → other
8. Descriere: copiaza descrierea originala din extras, scurtata la max 50 caractere, fara caracterul | in interior
9. Spatiu inainte si dupa fiecare | (obligatoriu)
10. FARA header, FARA linii goale, FARA text explicativ, FARA marcaje de cod
11. Incepe DIRECT cu prima linie de date

RASPUNDE DOAR CU LINIILE IN FORMAT PIPE. NIMIC ALTCEVA.`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "csv") { setCopiedCSV(true); setTimeout(() => setCopiedCSV(false), 2000); }
      else { setCopiedLLM(true); setTimeout(() => setCopiedLLM(false), 2000); }
      showToast("Prompt copiat in clipboard");
    });
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  const processImport = (text) => {
    // Blocat daca nu are WRITE
    if (!canWrite) {
      showToast("Necesita permisiunea WRITE pentru a importa", "error");
      return;
    }
    if (!text?.trim()) { showToast("Nu exista text de importat", "error"); return; }

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      if (
        line.startsWith("#") || line.startsWith("-") ||
        line.startsWith("Generat") || line.startsWith("Total") ||
        line.startsWith("##") || line.startsWith("```") ||
        /^data[,|]/i.test(line) || /^date[,|]/i.test(line)
      ) continue;

      if (line.match(/^\d{4}-\d{2}-\d{2}\s*\|/)) {
        const parts = line.split("|").map(s => s.trim());
        const date = parts[0];
        const amount = parseFloat(parts[1]);
        const category = (parts[2] || "").toLowerCase().trim();
        const description = parts[3] || "";
        if (date && !isNaN(amount) && amount > 0 && category) {
          parsed.push({ date, amount, category, description });
        }
        continue;
      }

      if (line.match(/^\d{4}-\d{2}-\d{2},/)) {
        const parts = parseCSVLine(line);
        if (parts.length >= 3) {
          const date = parts[0];
          const amount = parseFloat(parts[1]);
          const category = (parts[2] || "").toLowerCase().trim();
          const description = parts.length >= 5 ? parts[4] : (parts[3] || "");
          if (date && !isNaN(amount) && amount > 0 && category) {
            parsed.push({ date, amount, category, description });
          }
        }
      }
    }

    if (parsed.length > 0) {
      onImport?.(parsed);
      showToast(`${parsed.length} inregistrari trimise spre import`);
      setPasteText("");
    } else {
      showToast("Nu s-au gasit inregistrari valide in text", "error");
    }
  };

  const handleFileChange = async (e) => {
    // Blocat daca nu are WRITE
    if (!canWrite) {
      showToast("Necesita permisiunea WRITE pentru a importa", "error");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      processImport(text);
    } catch (err) {
      showToast("Eroare la citirea fisierului", "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const activePrompt = activeFormat === "csv" ? AI_PROMPT_CSV : AI_PROMPT_LLM;
  const activeCopied = activeFormat === "csv" ? copiedCSV : copiedLLM;

  // Banner READ-only pentru sectiunea de import
  const ImportLockedBanner = () => (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 18px",
      background: "rgba(239,68,68,0.06)",
      border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 6,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 18 }}>🔒</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>Import dezactivat</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          Necesita permisiunea <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1D9E75" }}>WRITE</span> pentru a importa tranzactii.
        </div>
      </div>
    </div>
  );

  return (
    <main className="fade-in">

      {/* ══════════════════════════════════════
          IMPORT DIN PDF BANCAR
      ══════════════════════════════════════ */}
      <div className="io-section">
        <div className="io-section-label">Import din extras de cont bancar</div>
        <p className="io-hint">
          Ataseaza PDF-ul bancii in Claude sau ChatGPT impreuna cu promptul de mai jos,
          apoi lipeste raspunsul sau incarca fisierul generat. Functioneaza cu orice banca.
        </p>

        {/* Banner daca nu are WRITE */}
        {!canWrite && <ImportLockedBanner />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>

          {/* STANGA: Prompt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
              1. Copiaza promptul
            </div>

            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <button
                onClick={() => setActiveFormat("llm")}
                style={{
                  flex: 1, padding: "7px 0", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  background: activeFormat === "llm" ? "var(--accent)" : "var(--surface)",
                  color: activeFormat === "llm" ? "#fff" : "var(--muted)",
                }}
              >
                Text LLM
              </button>
              <button
                onClick={() => setActiveFormat("csv")}
                style={{
                  flex: 1, padding: "7px 0", fontSize: 13, fontWeight: 600,
                  border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer",
                  background: activeFormat === "csv" ? "var(--accent)" : "var(--surface)",
                  color: activeFormat === "csv" ? "#fff" : "var(--muted)",
                }}
              >
                CSV
              </button>
            </div>

            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
              padding: "12px 14px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.65,
              color: "var(--text)", whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 280, flex: 1,
            }}>
              {activePrompt}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-main"
                style={{ flex: 1 }}
                onClick={() => copyToClipboard(activePrompt, activeFormat)}
              >
                {activeCopied ? "✓ Copiat!" : "Copiaza prompt"}
              </button>
              <a href="https://claude.ai" target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                Claude →
              </a>
              <a href="https://chat.openai.com" target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                GPT →
              </a>
            </div>
          </div>

          {/* DREAPTA: Import — dezactivat vizual daca nu are WRITE */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: canWrite ? 1 : 0.45, pointerEvents: canWrite ? "auto" : "none" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
              2. Importa raspunsul
              {!canWrite && <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 10, fontFamily: "monospace" }}>🔒 WRITE required</span>}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className="btn-upload"
              onClick={() => {
                if (!canWrite) {
                  showToast("Necesita permisiunea WRITE pentru a importa", "error");
                  return;
                }
                fileRef.current?.click();
              }}
              disabled={importing}
              style={{ width: "100%", cursor: canWrite ? "pointer" : "not-allowed" }}
            >
              {importing ? "Se importa..." : "↑  Incarca fisier  .csv / .txt"}
            </button>

            <div className="field" style={{ flex: 1, display: "flex", flexDirection: "column", margin: 0 }}>
              <label style={{ marginBottom: 6 }}>Sau lipeste textul direct</label>
              <textarea
                value={pasteText}
                onChange={e => canWrite && setPasteText(e.target.value)}
                readOnly={!canWrite}
                placeholder={
                  !canWrite
                    ? "Import dezactivat — necesita permisiunea WRITE"
                    : activeFormat === "llm"
                      ? "2026-04-01 | 7500.00 | housing | Chirie\n2026-04-03 | 485.50 | food | Kaufland\n..."
                      : "2026-04-01,7500.00,housing,Chirie\n2026-04-03,485.50,food,Kaufland\n..."
                }
                style={{ flex: 1, minHeight: 200, resize: "vertical", cursor: canWrite ? "text" : "not-allowed" }}
              />
            </div>

            <button
              className="btn btn-main"
              onClick={() => {
                if (!canWrite) {
                  showToast("Necesita permisiunea WRITE pentru a importa", "error");
                  return;
                }
                processImport(pasteText);
              }}
              disabled={!canWrite || !pasteText.trim()}
              style={{ width: "100%", opacity: (canWrite && pasteText.trim()) ? 1 : 0.4, cursor: canWrite ? "pointer" : "not-allowed" }}
            >
              Importa tranzactiile
            </button>
          </div>
        </div>
      </div>

      <div className="io-divider" />

      {/* ══════════════════════════════════════
          EXPORT DATE PROPRII
      ══════════════════════════════════════ */}
      <div className="io-section">
        <div className="io-section-label">Export date proprii</div>
        {!canAnalyze && (
          <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, fontStyle: "italic" }}>
            🔒 Necesita permisiunea ANALYZE pentru export
          </div>
        )}
        <div className="io-grid" style={{ opacity: canAnalyze ? 1 : 0.4 }}>
          <div className="io-card" onClick={exportCSV} style={{ cursor: canAnalyze ? "pointer" : "not-allowed" }}>
            <div className="io-card-name">CSV</div>
            <div className="io-card-desc">Compatibil Excel / Google Sheets</div>
          </div>
          <div className="io-card" onClick={exportLLM} style={{ cursor: canAnalyze ? "pointer" : "not-allowed" }}>
            <div className="io-card-name">Text LLM</div>
            <div className="io-card-desc">Backup pentru reimport</div>
          </div>
        </div>
      </div>

      <div className="io-divider" />

      {/* ══════════════════════════════════════
          API INFO + TOKEN
      ══════════════════════════════════════ */}
      <div className="io-section">
        <div className="io-section-label">API Info</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            {[
              ["Base URL", API_BASE],
              ["Swagger UI", "localhost:3001/docs"],
              ["Token Endpoint", "POST /token"],
              ["Token Expiry", "60 secunde (demo)"],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="card-label">{label}</div>
                <code style={{ fontSize: 13, color: "var(--accent)" }}>{val}</code>
              </div>
            ))}
          </div>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="btn btn-main"
            style={{ display: "inline-block", textDecoration: "none", padding: "12px 24px" }}>
            Open Swagger UI
          </a>
        </div>

        <div className="io-section-label">Token curent</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: countdown > 15 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
              {countdown > 0 ? `Expira in ${countdown}s` : "Expirat"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Permisiuni:</span>
            {permissions.map(p => {
              const colors = { READ: "#378ADD", WRITE: "#1D9E75", DELETE: "#D85A30", ANALYZE: "#7F77DD" };
              return (
                <span key={p} style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: colors[p] || "var(--muted)" }}>
                  {p}
                </span>
              );
            })}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", wordBreak: "break-all", background: "var(--stripe)", padding: "10px 14px", borderRadius: 4 }}>
            {token}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onLogout}>
            Logout / Token nou
          </button>
        </div>
      </div>

      <div className="io-divider" />

      {/* ══════════════════════════════════════
          STATISTICI
      ══════════════════════════════════════ */}
      <div className="io-stats-grid">
        {[
          ["Inregistrari", stats?.totalExpenses ?? expenses.length],
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