import React, { useState, useEffect } from "react";
import "../theme.css";
import Loader from "./Loader";
import { API_BASE_URL } from '../utils/api';

export default function CardSearchDetailModal({ card: propCard, cardId, onClose, onNext, onPrev, hasNext, hasPrev, deckContext }) {
  const [fetchedCard, setFetchedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const activeCard = propCard || fetchedCard;

  useEffect(() => {
    if (propCard) {
      setLoading(false);
      setImageLoading(true);
      setIsFlipped(false);
      return;
    }

    let cancelled = false;
    async function fetchCard() {
      setLoading(true);
      setImageLoading(true);
      setIsFlipped(false);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/cards/${cardId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Impossible de charger la carte");
        const data = await res.json();
        if (!cancelled) setFetchedCard(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    if (cardId) fetchCard();
    return () => { cancelled = true; };
  }, [cardId, propCard]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev, onClose]);

  const hasMultipleFaces = activeCard && activeCard.card_faces && activeCard.card_faces.length > 1 && 
    activeCard.card_faces.some(face => face.image_uris?.normal || face.image_uris?.border_crop);

  const handleFaceFlip = () => {
    if (!hasMultipleFaces) return;
    setIsFlipping(true);
    setTimeout(() => { setIsFlipped((prev) => !prev); setIsFlipping(false); }, 150);
  };

  if (loading && !activeCard && !error) {
      return (
          <div className="modal-overlay" onClick={onClose}>
              <div className="modal-box justify-center items-center" style={{ background: "transparent", boxShadow: "none" }} onClick={e => e.stopPropagation()}>
                  <Loader />
              </div>
          </div>
      );
  }

  if (error) {
      return (
          <div className="modal-overlay" onClick={onClose}>
              <div className="modal-content text-center" style={{ width: "400px", padding: "30px" }} onClick={e => e.stopPropagation()}>
                  <h3 className="m-0 text-danger">Erreur</h3>
                  <p style={{ color: "var(--text-main)", lineHeight: "1.5" }}>{error}</p>
                  <button onClick={onClose} className="btn-secondary w-full mt-10">Fermer</button>
              </div>
          </div>
      );
  }

  if (!activeCard) return null;

  let imageUrl = activeCard.image_normal || activeCard.image_uris?.normal || activeCard.image_border_crop || activeCard.image_uris?.border_crop || null;
  let displayedName = activeCard.name;
  let displayedOracleText = activeCard.oracle_text || "";

  if (hasMultipleFaces) {
    const activeFaceIndex = isFlipped ? 1 : 0;
    const activeFace = activeCard.card_faces[activeFaceIndex];
    imageUrl = activeFace?.image_uris?.normal || activeFace?.image_uris?.border_crop || imageUrl;
    displayedName = activeFace?.name || activeCard.name;
    displayedOracleText = activeFace?.oracle_text || "";
  } else if (!displayedOracleText && activeCard.card_faces) {
    displayedOracleText = activeCard.card_faces.map(face => face.oracle_text).join("\n\n//\n\n");
  }
  
  const priceEur = activeCard.prices?.eur;
  const purchaseUris = activeCard.purchase_uris || {};

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      
      <div className="modal-content card-modal-content">
        
        <button onClick={onClose} className="card-close-btn" title="Fermer">✕</button>

        {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="card-nav-btn card-nav-prev" title="Carte précédente">&#10094;</button>}
        {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="card-nav-btn card-nav-next" title="Carte suivante">&#10095;</button>}

        {/* TITRE MOBILE UNIQUEMENT (Masqué sur PC) */}
        <h2 className="mobile-card-title">{displayedName}</h2>

        {/* COLONNE 1 : IMAGE */}
        <div className="card-col-image">
          {imageLoading && imageUrl && (
            <div className="loader-overlay-absolute">
              <Loader />
            </div>
          )}
          {imageUrl ? (
            <img 
              key={imageUrl} src={imageUrl} alt={displayedName} onClick={handleFaceFlip} onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} 
              className="card-img-large"
              style={{ 
                cursor: hasMultipleFaces ? "pointer" : "default", 
                transform: isFlipping ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)", 
                opacity: (isFlipping || imageLoading) ? 0 : 1
              }} 
            />
          ) : (
            <div className="card-placeholder">Image indisponible</div>
          )}
          {hasMultipleFaces && (
            <button onClick={handleFaceFlip} className="btn-outline-primary w-full mt-15 font-bold">Retourner la carte</button>
          )}
        </div>

        {/* COLONNE 2 : INFOS & TEXTE */}
        <div className="card-col-info">
          
          {/* TITRE PC UNIQUEMENT */}
          <h2 className="card-title-lg desktop-card-title" style={{ opacity: (isFlipping || imageLoading) ? 0 : 1 }}>
            {displayedName}
          </h2>

          <div className="card-details-section">
            <div><strong>Set :</strong> {activeCard.set_name} ({activeCard.set?.toUpperCase()} #{activeCard.collector_number})</div>
            <div><strong>Langue :</strong> {activeCard.lang?.toUpperCase() || "EN"}</div>
            <div><strong>Prix estimé :</strong> <span className="text-lg ml-5 font-bold text-success">{priceEur ? `${priceEur} EUR` : "N/A"}</span></div>
          </div>

          <div className="oracle-text-container" style={{ opacity: (isFlipping || imageLoading) ? 0 : 1 }}>
            {displayedOracleText || "Aucun texte pour cette face."}
          </div>

        </div>

        {/* COLONNE 3 : ACTIONS */}
        <div className="card-col-actions">
          
          {Object.keys(purchaseUris).length > 0 && (
              <div>
                  <h4 className="m-0 mb-10 text-lg">Acheter</h4>
                  <div className="flex flex-col gap-8">
                      {purchaseUris.cardmarket && <a href={purchaseUris.cardmarket} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-cardmarket">Cardmarket</a>}
                      {purchaseUris.tcgplayer && <a href={purchaseUris.tcgplayer} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-tcgplayer">TCGPlayer</a>}
                      {purchaseUris.cardhoarder && <a href={purchaseUris.cardhoarder} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-cardhoarder">Cardhoarder</a>}
                  </div>
              </div>
          )}

          {deckContext && (
            <div className="mt-15">
                <h4 className="m-0 mb-10 text-lg text-primary">Gestion du Deck</h4>
                <div className="deck-mgmt-box">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex flex-col">
                            <span className="font-bold">Quantité manquante</span>
                            <span className="text-sm" style={{color: "var(--text-muted)"}}>{deckContext.isSideboard ? "(Réserve)" : "(Principal)"}</span>
                        </div>
                        <span className="text-2xl font-bold text-danger">x{deckContext.quantity}</span>
                    </div>
                    <div className="flex gap-10">
                        <button onClick={deckContext.onRemove} className="btn-danger-filled flex-1 font-bold text-xl" style={{ padding: "8px" }}>-</button>
                        <button onClick={deckContext.onAdd} className="btn-primary flex-1 font-bold text-xl" style={{ padding: "8px" }}>+</button>
                    </div>
                    {deckContext.quantity === 1 && (
                        <div className="text-sm mt-8 text-center" style={{color: "var(--text-muted)"}}>
                            (Retirer passera à la suivante)
                        </div>
                    )}
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}