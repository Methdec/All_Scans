import React, { useEffect, useState } from "react";
import "../theme.css";

export default function DeckPickerModal({ onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger la liste des decks au montage
  useEffect(() => {
    fetch("http://localhost:8000/items/all_lists_and_decks", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        // On ne garde que les decks (pas les listes si tu en as, ou les dossiers)
        const decks = (data.items || []).filter(i => i.type === "deck");
        setItems(decks);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-content" style={{ width: "350px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Ajouter au deck...</h3>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Chargement...</p>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.length === 0 ? (
                <p style={{textAlign:"center", color:"var(--text-muted)"}}>Aucun deck trouvé.</p>
            ) : (
                items.map((deck) => (
                    <div 
                        key={deck.id} 
                        onClick={() => onSelect(deck.id)}
                        className="item-card-row" // On va définir ce style CSS juste après
                        style={{ 
                            display: "flex", alignItems: "center", gap: 10, padding: 10, 
                            borderRadius: "var(--radius)", cursor: "pointer", border: "1px solid transparent",
                            transition: "background 0.2s"
                        }}
                    >
                        {/* Petite image du deck */}
                        <div style={{ width: 40, height: 40, borderRadius: 4, overflow: "hidden", background: "#333", flexShrink: 0 }}>
                            {deck.image ? (
                                <img src={deck.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>🃏</div>
                            )}
                        </div>
                        
                        {/* Info Deck */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "bold", color: "var(--text-main)" }}>{deck.nom}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {deck.format} • {deck.cards ? deck.cards.length : 0} cartes
                            </div>
                        </div>
                        
                        <span style={{ color: "var(--primary)", fontSize: "1.2rem" }}>+</span>
                    </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}