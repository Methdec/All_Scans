import React from "react";
import "../App.css";
import { API_BASE_URL } from '../utils/api';

/**
 * Composant réutilisable pour afficher une grille de cartes
 * @param {Array} cards - Liste des cartes à afficher
 * @param {Function} renderAction - Fonction qui retourne le JSX du bouton d'action pour chaque carte
 * @param {Function} onCardClick - (Optionnel) Fonction appelée au clic sur la carte
 * @param {Boolean} clickableCards - Si true, les cartes ouvriraient une modale (défaut: true)
 */
function CardGrid({ cards, renderAction, onCardClick, clickableCards = true }) {
  const getImageUrl = (card) => {
    // Cherche l'image dans cet ordre de priorité :
    // 1. Depuis MongoDB (collection) : image_normal
    // 2. Depuis Scryfall API (cartes normales) : image_uris.normal
    // 3. Depuis Scryfall API (cartes multi-faces) : card_faces[0].image_uris.normal
    return (
      card.image_normal ||
      card.image_uris?.normal ||
      card.card_faces?.[0]?.image_uris?.normal ||
      card.image_border_crop ||
      null
    );
  };

  if (!cards || cards.length === 0) {
    return <p style={{ color: "var(--text-muted)", width: "100%", textAlign: "center" }}>Aucune carte trouvée.</p>;
  }

  return (
    <div 
      className="cards-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "20px"
      }}
    >
      {cards.map((card) => {
        const imageUrl = getImageUrl(card);
        const cardId = card.id || card._id; // Gère à la fois l'id Scryfall et l'id MongoDB

        return (
          <div
            key={cardId}
            className="card-item"
            onClick={() => {
              if (clickableCards) onCardClick?.(cardId);
            }}
            style={{
              backgroundColor: "var(--bg-input, #1e1e1e)",
              borderRadius: "10px",
              padding: "12px",
              cursor: clickableCards ? "pointer" : "default",
              display: "flex",
              flexDirection: "column",
              border: "2px solid transparent",
              transition: "border-color 0.2s, transform 0.2s",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
            }}
            onMouseEnter={(e) => {
              if (clickableCards) {
                e.currentTarget.style.borderColor = "var(--primary, #FF9800)";
                e.currentTarget.style.transform = "translateY(-4px)";
              }
            }}
            onMouseLeave={(e) => {
              if (clickableCards) {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            {/* 1. Image de la carte (en haut) */}
            <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={card.name}
                  style={{ 
                    width: "100%", 
                    height: "auto", 
                    borderRadius: "4.75% / 3.5%", // Ratio fidèle aux vraies cartes
                    display: "block" 
                  }}
                />
              ) : (
                <div style={{ 
                  width: "100%", 
                  aspectRatio: "2.5/3.5", 
                  backgroundColor: "#333", 
                  borderRadius: "8px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "#666" 
                }}>
                  Pas d'image
                </div>
              )}
            </div>

            {/* 2. Informations sous la carte */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
              
              {/* Nom de la carte */}
              <div style={{ 
                fontWeight: "bold", 
                color: "var(--text-main, #fff)", 
                fontSize: "0.95rem", 
                textAlign: "center", 
                marginBottom: "6px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }} title={card.name}>
                {card.name}
              </div>
              
              {/* Ligne du bas : Set (à gauche) et Action (à droite) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ 
                  color: "var(--text-muted, #aaa)", 
                  fontSize: "0.8rem", 
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1
                }} title={card.set_name}>
                  {card.set_name}
                </span>
                
                {/* Zone d'action (Bouton d'ajout, label de quantité x1, etc.) */}
                {renderAction && renderAction(card)}
              </div>
              
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CardGrid;