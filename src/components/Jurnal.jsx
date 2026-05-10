import React, { useState } from "react";

export default function Jurnal({
  expenses,
  categories,
  filterMonth,
  setFilterMonth,
  filterCat,
  setFilterCat,
  sortOrder,
  setSortOrder,
  monthsList,
  pagination,
  formatCurrency,
  onAdd,
  onEdit,
  onDelete,
  onDeleteAll,
  fetchAll,
}) {
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  const canWrite = !!onAdd;
  const canDelete = !!onDelete;

  const handleDeleteAll = () => {
    setShowConfirmAll(false);
    onDeleteAll?.();
  };

  return (
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
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
            <option value="date_desc">Data desc</option>
            <option value="date_asc">Data asc</option>
            <option value="amount_desc">Suma desc</option>
            <option value="amount_asc">Suma asc</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Sterge toate — doar daca are DELETE */}
          {canDelete && expenses.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowConfirmAll(true)}
              style={{
                borderColor: "rgba(239,68,68,0.4)",
                color: "#ef4444",
                fontSize: 12,
              }}
            >
              Sterge tot
            </button>
          )}

          {/* Adauga — doar daca are WRITE */}
          {canWrite ? (
            <button className="btn btn-main" onClick={onAdd}>+ Inregistrare Noua</button>
          ) : (
            <button
              className="btn btn-ghost"
              disabled
              title="Necesita permisiunea WRITE"
              style={{ opacity: 0.4, cursor: "not-allowed" }}
            >
              + Inregistrare Noua
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="col-date">Data</th>
              <th className="col-desc">Explicatie Tranzactie</th>
              <th className="col-cat">Categorie</th>
              <th className="col-amount">Suma</th>
              {(canWrite || canDelete) && <th className="col-actions">Actiuni</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => {
              const cat = categories.find(c => c.id === exp.category);
              return (
                <tr key={exp.id}>
                  <td className="col-date">{exp.date}</td>
                  <td className="col-desc">{exp.description || "-"}</td>
                  <td className="col-cat">
                    <span className="cat-label">
                      <span className="cat-dot-sm" style={{ background: cat?.color || "#999" }} />
                      {cat?.name || exp.category}
                    </span>
                  </td>
                  <td className="col-amount amount-cell">{formatCurrency(exp.amount)}</td>
                  {(canWrite || canDelete) && (
                    <td className="col-actions">
                      {canWrite && (
                        <button className="edit-btn" onClick={() => onEdit(exp)} title="Editeaza">✎</button>
                      )}
                      {canDelete && (
                        <button className="del-btn" onClick={() => onDelete(exp.id)} title="Sterge">✕</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {expenses.length === 0 && <div className="empty-msg">Nicio inregistrare gasita.</div>}
      </div>

      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center", justifyContent: "center" }}>
          <button className="btn btn-ghost" disabled={pagination.page === 1} onClick={() => fetchAll(pagination.page - 1)}>Prev</button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Pagina {pagination.page} / {pagination.totalPages} ({pagination.total} total)
          </span>
          <button className="btn btn-ghost" disabled={pagination.page === pagination.totalPages} onClick={() => fetchAll(pagination.page + 1)}>Next</button>
        </div>
      )}

      {/* Modal confirmare Sterge Tot */}
      {showConfirmAll && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfirmAll(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h2 className="serif-header" style={{ fontSize: 26, color: "#ef4444" }}>Sterge toate?</h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>
              Aceasta actiune va sterge <strong style={{ color: "var(--text)" }}>toate {pagination.total} tranzactiile</strong> din baza de date.
            </p>
            <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 28, fontWeight: 600 }}>
              Actiunea este ireversibila.
            </p>
            <div className="modal-footer">
              <button
                className="btn"
                style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none" }}
                onClick={handleDeleteAll}
              >
                Da, sterge tot
              </button>
              <button className="btn btn-ghost" onClick={() => setShowConfirmAll(false)}>Anuleaza</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}