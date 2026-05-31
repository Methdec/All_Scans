import React from "react";
import '../theme.css'; // On ne garde que le theme global
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
    <div className="cards-grid">
      {cards.map((card) => {
        const imageUrl = getImageUrl(card);
        const cardId = card.id || card._id; 

        return (
          <div
            key={cardId}
            // Utilisation des classes CSS définies dans theme.css
            className={`card-item ${clickableCards ? 'clickable' : ''}`}
            onClick={() => {
              if (clickableCards) onCardClick?.(cardId);
            }}
          >
            {/* 1. Image de la carte (en haut) */}
            <div className="card-image-wrapper">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={card.name}
                  className="card-img"
                />
              ) : (
                <div className="card-no-image">
                  Pas d'image
                </div>
              )}
            </div>

            {/* 2. Informations sous la carte */}
            <div className="card-info-container">
              
              <div className="card-name" title={card.name}>
                {card.name}
              </div>
              
              <div className="card-bottom-line">
                <span className="card-set-name" title={card.set_name}>
                  {card.set_name}
                </span>
                
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