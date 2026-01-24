import React, { useState } from "react";
import "../theme.css";

export default function CardSearchDetailModal({ card, onClose, onAddToCollection }) {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAddClick = async () => {
    setIsAdding(true);
    setError("");
    try {
      await onAddToCollection(card);
    } catch (err) {
      setError("Erreur ajout");
      setIsAdding(false);
    }
  };

  const imageUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-content" style={{ display: "flex", gap: 20, width: 700, maxWidth: "95%" }}>
        
        <button onClick={onClose} className="modal-close">✕</button>

        {/* Colonne Image */}
        <div style={{ flex: "0 0 250px" }}>
          {imageUrl ? (
            <img src={imageUrl} alt={card.name} style={{ width: "100%", borderRadius: "var(--radius)", boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }} />
          ) : (
            <div style={{ width: "100%", height: 350, background: "#333", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }}>No Image</div>
          )}
        </div>

        {/* Colonne Détails */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginTop: 0, color: "var(--primary)" }}>{card.name}</h2>
          
          <div style={{ flex: 1, color: "var(--text-main)", lineHeight: 1.6 }}>
             {card.mana_cost && <p><strong>Coût:</strong> {card.mana_cost}</p>}
             <p><strong>Type:</strong> {card.type_line}</p>
             <p style={{ whiteSpace: "pre-wrap", fontStyle: "italic", color: "var(--text-muted)" }}>{card.oracle_text}</p>
             {card.set_name && <p><strong>Édition:</strong> {card.set_name}</p>}
          </div>

          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

          <button 
            onClick={handleAddClick} 
            disabled={isAdding} 
            className="btn-primary" 
            style={{ marginTop: 20, width: "100%" }}
          >
            {isAdding ? "Ajout..." : "Ajouter à ma collection"}
          </button>
        </div>

      </div>
    </div>
  );
}