import React from "react";

export default function Categorii({ 
  categories, 
  newCategory, 
  setNewCategory, 
  editingCat, 
  onAddCategory, 
  onEditCategory, 
  onSaveEditCategory, 
  onCancelEdit, 
  onDeleteCategory 
}) {
  return (
    <main className="fade-in">
      <div className="categories-section">
        <h2>Gestionare Categorii</h2>
        <p className="io-hint">Personalizati categoriile pentru cheltuieli. Modificarile se aplica imediat.</p>

        <div className="add-category-form">
          <input
            type="text"
            placeholder="Nume categorie noua"
            value={newCategory.name}
            onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))}
          />
          <input
            type="color"
            value={newCategory.color}
            onChange={e => setNewCategory(p => ({ ...p, color: e.target.value }))}
          />
          {editingCat ? (
            <>
              <button className="btn btn-main" onClick={onSaveEditCategory}>Salveaza</button>
              <button className="btn btn-ghost" onClick={onCancelEdit}>Anuleaza</button>
            </>
          ) : (
            <button className="btn btn-main" onClick={onAddCategory}>+ Adauga</button>
          )}
        </div>

        <div className="categories-list">
          {categories.map(cat => (
            <div key={cat.id} className="category-item">
              <div className="category-info">
                <span className="cat-dot-lg" style={{ background: cat.color }} />
                <div>
                  <div className="category-name">{cat.name}</div>
                  <div className="category-id">ID: {cat.id}</div>
                </div>
              </div>
              <div className="category-actions">
                <span className="category-count">{cat.expenseCount} tranzactii</span>
                <button className="btn-ghost-sm" onClick={() => onEditCategory(cat)}>Editeaza</button>
                {cat.id !== "other" && (
                  <button className="btn-ghost-sm delete" onClick={() => onDeleteCategory(cat.id)}>Sterge</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}