import React, { useState } from "react";
import { apiFetch } from "../api/client.js";

export default function LoginScreen({ onLogin }) {
  const [tokenRole, setTokenRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/token", {
        method: "POST",
        body: JSON.stringify({ role: tokenRole }),
      });
      onLogin(data.token, data.expiresIn, tokenRole);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 4, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>Sistem de Evidenta si Gestiune</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontStyle: "italic" }}>Finance Tracker</h1>
        <p style={{ color: "var(--muted)", marginTop: 12, fontSize: 14 }}>Connect to the API to get started</p>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <div className="card-label">API Authentication</div>
        <div className="field" style={{ marginBottom: 16, marginTop: 16 }}>
          <label>Select Role</label>
          <select value={tokenRole} onChange={e => setTokenRole(e.target.value)} style={{ width: "100%" }}>
            <option value="ADMIN">ADMIN - Read, Write, Delete</option>
            <option value="WRITER">WRITER - Read, Write</option>
            <option value="VISITOR">VISITOR - Read only</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Token expires in <strong>60 seconds</strong> (demo). After expiry, get a new one.
        </p>
        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button className="btn btn-main" style={{ width: "100%" }} onClick={getToken} disabled={loading}>
          {loading ? "Connecting..." : "Get JWT Token"}
        </button>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>
          <strong>API Docs:</strong>{" "}
          <a href="http://localhost:3001/docs" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            localhost:3001/docs
          </a>{" "}(Swagger UI)
        </div>
      </div>
    </div>
  );
}