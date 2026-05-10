import React, { useState } from "react";
import { apiFetch } from "../api/client.js";

const PERMISSIONS = [
  {
    id: "READ",
    label: "READ",
    desc: "Vizualizare cheltuieli, categorii, salariu",
  },
  {
    id: "WRITE",
    label: "WRITE",
    desc: "Adaugare si editare cheltuieli, categorii, salariu",
  },
  {
    id: "DELETE",
    label: "DELETE",
    desc: "Stergere cheltuieli si categorii",
  },
  {
    id: "ANALYZE",
    label: "ANALYZE",
    desc: "Statistici, grafice, exporturi CSV/LLM",
  },
];

const PRESETS = [
  { label: "Proprietar", perms: ["READ", "WRITE", "DELETE", "ANALYZE"] },
  { label: "Auditor",    perms: ["READ", "ANALYZE"] },
  { label: "Contabil",   perms: ["READ", "WRITE"] },
  { label: "Vizitator",  perms: ["READ"] },
];

const PERM_COLORS = {
  READ:    "#378ADD",
  WRITE:   "#1D9E75",
  DELETE:  "#D85A30",
  ANALYZE: "#7F77DD",
};

export default function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState(["READ", "WRITE", "DELETE", "ANALYZE"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (perm) => {
    setSelected(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const applyPreset = (perms) => setSelected(perms);

  const getToken = async () => {
    if (selected.length === 0) {
      setError("Selecteaza cel putin o permisiune");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/token", {
        method: "POST",
        body: JSON.stringify({ permissions: selected }),
      });
      onLogin(data.token, data.expiresIn, data.permissions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        gap: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 4, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>
          Sistem de Evidenta si Gestiune
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontStyle: "italic" }}>
          Finance Tracker
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 14 }}>
          Selecteaza permisiunile pentru acest token
        </p>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 460 }}>
        <div className="card-label" style={{ marginBottom: 16 }}>Permisiuni Token</div>

        {/* Permisiuni individuale */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {PERMISSIONS.map(p => {
            const isOn = selected.includes(p.id);
            return (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  border: `1px solid ${isOn ? PERM_COLORS[p.id] + "66" : "var(--border)"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isOn ? PERM_COLORS[p.id] + "0d" : "var(--surface)",
                  transition: "all 0.15s ease",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(p.id)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: PERM_COLORS[p.id] }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? PERM_COLORS[p.id] : "var(--text)", fontFamily: "monospace" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {p.desc}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Preset-uri rapide */}
        <div style={{ marginBottom: 20 }}>
          <div className="card-label" style={{ marginBottom: 10 }}>Preset-uri rapide</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESETS.map(pr => {
              const isActive = JSON.stringify([...pr.perms].sort()) === JSON.stringify([...selected].sort());
              return (
                <button
                  key={pr.label}
                  onClick={() => applyPreset(pr.perms)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 20,
                    background: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "#fff" : "var(--muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "inherit",
                  }}
                >
                  {pr.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Token summary */}
        <div style={{
          padding: "10px 14px",
          background: "var(--stripe)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 12,
          color: "var(--muted)",
        }}>
          Token va contine:{" "}
          {selected.length === 0
            ? <span style={{ color: "#ef4444" }}>nicio permisiune selectata</span>
            : selected.map(p => (
                <span key={p} style={{ color: PERM_COLORS[p], fontWeight: 700, marginRight: 6, fontFamily: "monospace" }}>
                  {p}
                </span>
              ))
          }
          <span style={{ marginLeft: 4 }}>· expira in <strong>60s</strong></span>
        </div>

        {error && (
          <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          className="btn btn-main"
          style={{ width: "100%", opacity: selected.length === 0 ? 0.4 : 1 }}
          onClick={getToken}
          disabled={loading || selected.length === 0}
        >
          {loading ? "Se conecteaza..." : "Obtine Token JWT"}
        </button>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>
          <strong>API Docs:</strong>{" "}
          <a href="http://localhost:3001/docs" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            localhost:3001/docs
          </a>{" "}
          (Swagger UI)
        </div>
      </div>
    </div>
  );
}