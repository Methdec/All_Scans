import React from "react";
import "../App.css";

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
    // 3. Depuis MongoDB (collection) : image_normal
    // 1. Depuis Scryfall API (cartes normales) : image_uris.normal
    // 2. Depuis Scryfall API (cartes multi-faces) : card_faces[0].image_uris.normal
    return (
      card.image_normal ||
      card.image_uris?.normal ||
      card.card_faces?.[0]?.image_uris?.normal ||
      card.image_border_crop ||
      null
    );
  };

  if (cards.length === 0) {
    return <p>Aucune carte trouvée.</p>;
  }

  return (
    <div className="cards-grid">
      {cards.map((card) => {
        const imageUrl = getImageUrl(card);
        const cardId = card.id; // Utiliser l'id Scryfall au lieu de _id MongoDB

        return (
          <div
            key={cardId}
            className="card-item"
            onClick={() => {
              if (clickableCards) onCardClick?.(cardId);
            }}
            style={{
              cursor: clickableCards ? "pointer" : "default",
              borderRadius: "8px",
              transition: "transform 0.2s",
            }}
            onMouseOver={(e) => {
              if (clickableCards) e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseOut={(e) => {
              if (clickableCards) e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <p>
              <strong>{card.name}</strong>
              {card.count && ` ×${card.count}`}
            </p>
            {imageUrl && (
              <img src={imageUrl} alt={card.name} className="card-image" />
            )}
            {renderAction && renderAction(card)}
          </div>
        );
      })}
    </div>
  );
}

export default CardGrid;
