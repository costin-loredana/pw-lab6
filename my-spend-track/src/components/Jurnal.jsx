import React from "react";

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
  fetchAll 
}) {
  return (
    <main className="fade-in">
      <div className="controls">
        <div className="filters">
          <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); }}>
            <option value="all">Toate lunile</option>
            {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterCat} onChange={e => { setFilterCat(e.target.value); }}>
            <option value="all">Toate categoriile</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sortOrder} onChange={e => { setSortOrder(e.target.value); }}>
            <option value="date_desc">Data desc</option>
            <option value="date_asc">Data asc</option>
            <option value="amount_desc">Suma desc</option>
            <option value="amount_asc">Suma asc</option>
          </select>
        </div>
        <button className="btn btn-main" onClick={onAdd}>+ Inregistrare Noua</button>
      </div>

      <div className="table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="col-date">Data</th>
              <th className="col-desc">Explicatie Tranzactie</th>
              <th className="col-cat">Categorie</th>
              <th className="col-amount">Suma</th>
              <th className="col-actions">Actiuni</th>
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
                  <td className="col-actions">
                    <button className="edit-btn" onClick={() => onEdit(exp)} title="Editeaza">✎</button>
                    <button className="del-btn" onClick={() => onDelete(exp.id)} title="Sterge">✕</button>
                  </td>
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
    </main>
  );
}