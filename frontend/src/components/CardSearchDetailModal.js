import React, { useState, useEffect } from "react";
import "../theme.css";
import Loader from "./Loader";
import { API_BASE_URL } from '../utils/api';

const PRIMARY_ORANGE = "#FF9800";
const BG_MAIN = "#121212"; 

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
              <div className="modal-box" style={{ justifyContent: "center", alignItems: "center", background: "transparent", boxShadow: "none" }} onClick={e => e.stopPropagation()}>
                  <Loader />
              </div>
          </div>
      );
  }

  if (error) {
      return (
          <div className="modal-overlay" onClick={onClose}>
              <div className="modal-content" style={{ width: "400px", padding: "30px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ color: "var(--danger)", marginTop: 0 }}>Erreur</h3>
                  <p style={{ color: "var(--text-main)", lineHeight: "1.5" }}>{error}</p>
                  <button onClick={onClose} className="btn-secondary" style={{ marginTop: "20px", width: "100%" }}>Fermer</button>
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

  const navButtonStyle = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", background: PRIMARY_ORANGE, color: BG_MAIN, border: "none", borderRadius: "50%",
    width: "60px", height: "60px", fontSize: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
  };

  const closeButtonStyle = {
    position: "absolute", top: "-15px", right: "-15px", background: PRIMARY_ORANGE, color: "white", border: `3px solid ${BG_MAIN}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, 
    width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", fontWeight: "bold", fontSize: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.5)", transition: "all 0.2s", zIndex: 20
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      
      {/* NOUVEAU LAYOUT : 1100px de large pour 3 colonnes */}
      <div className="modal-content" style={{ display: "flex", gap: "25px", width: "1100px", maxWidth: "95%", padding: "30px", position: "relative", overflow: "visible" }}>
        
        <button onClick={onClose} style={closeButtonStyle} onMouseOver={(e) => e.target.style.background = "#e68a00"} onMouseOut={(e) => e.target.style.background = PRIMARY_ORANGE} title="Fermer">X</button>

        {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} style={{ ...navButtonStyle, left: "-80px" }} onMouseOver={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = BG_MAIN; }} onMouseOut={(e) => { e.currentTarget.style.background = PRIMARY_ORANGE; e.currentTarget.style.color = BG_MAIN; }} title="Carte precedente">&#10094;</button>}
        {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{ ...navButtonStyle, right: "-80px" }} onMouseOver={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = BG_MAIN; }} onMouseOut={(e) => { e.currentTarget.style.background = PRIMARY_ORANGE; e.currentTarget.style.color = BG_MAIN; }} title="Carte suivante">&#10095;</button>}

        {/* COLONNE 1 : IMAGE */}
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minHeight: "420px" }}>
          {imageLoading && imageUrl && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
              <Loader />
            </div>
          )}
          {imageUrl ? (
            <img 
              key={imageUrl} src={imageUrl} alt={displayedName} onClick={handleFaceFlip} onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} 
              style={{ width: "100%", borderRadius: "4.75% / 3.5%", boxShadow: "0 10px 20px rgba(0,0,0,0.5)", cursor: hasMultipleFaces ? "pointer" : "default", transform: isFlipping ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)", opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "transform 0.15s, opacity 0.15s", zIndex: 1 }} 
            />
          ) : (
            <div style={{ width: "100%", height: "420px", background: "var(--bg-input)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Image indisponible</div>
          )}
          {hasMultipleFaces && (
            <button onClick={handleFaceFlip} style={{ marginTop: "15px", padding: "8px 15px", background: "transparent", border: "1px solid var(--primary, #FF9800)", color: "var(--primary, #FF9800)", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", width: "100%", transition: "all 0.2s" }} onMouseOver={(e) => { e.target.style.background = "var(--primary, #FF9800)"; e.target.style.color = "white"; }} onMouseOut={(e) => { e.target.style.background = "transparent"; e.target.style.color = "var(--primary, #FF9800)"; }}>Retourner la carte</button>
          )}
        </div>

        {/* COLONNE 2 : INFOS & TEXTE */}
        <div style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          <h2 style={{ margin: "0 0 10px 0", color: "var(--primary, #FF9800)", fontSize: "1.8rem", lineHeight: 1.2, opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "opacity 0.15s" }}>
            {displayedName}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "15px 0", borderTop: "1px solid var(--border, #eaeaea)", borderBottom: "1px solid var(--border, #eaeaea)", marginBottom: "15px", color: "var(--text-muted, #666)", fontSize: "0.95rem" }}>
            <div><strong>Set :</strong> {activeCard.set_name} ({activeCard.set?.toUpperCase()} #{activeCard.collector_number})</div>
            <div><strong>Langue :</strong> {activeCard.lang?.toUpperCase() || "EN"}</div>
            <div><strong>Prix estimé :</strong> <span style={{ fontSize: "1.1rem", color: "#4CAF50", fontWeight: "bold", marginLeft: "5px" }}>{priceEur ? `${priceEur} EUR` : "N/A"}</span></div>
          </div>

          <div style={{ flex: 1, color: "var(--text-main, #333)", lineHeight: 1.6, fontSize: "1rem", overflowY: "auto", opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "opacity 0.15s", paddingRight: "10px" }}>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{displayedOracleText || "Aucun texte pour cette face."}</p>
          </div>

        </div>

        {/* COLONNE 3 : ACTIONS */}
        <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "25px", borderLeft: "1px solid var(--border)", paddingLeft: "25px" }}>
          
          {/* Bloc Achat */}
          {Object.keys(purchaseUris).length > 0 && (
              <div>
                  <h4 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "1.1rem" }}>Acheter</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {purchaseUris.cardmarket && <a href={purchaseUris.cardmarket} target="_blank" rel="noopener noreferrer" style={{ background: "#003b8e", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>Cardmarket</a>}
                      {purchaseUris.tcgplayer && <a href={purchaseUris.tcgplayer} target="_blank" rel="noopener noreferrer" style={{ background: "#1c52a3", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>TCGPlayer</a>}
                      {purchaseUris.cardhoarder && <a href={purchaseUris.cardhoarder} target="_blank" rel="noopener noreferrer" style={{ background: "#ff6f00", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>Cardhoarder</a>}
                  </div>
              </div>
          )}

          {/* Bloc Contexte Deck (Pour les cartes manquantes affichées dans DeckDetails) */}
          {deckContext && (
            <div>
                <h4 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontSize: "1.1rem" }}>Gestion du Deck</h4>
                <div style={{ padding: "15px", background: "rgba(255, 152, 0, 0.05)", border: "1px solid var(--primary)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "bold", color: "var(--text-main)" }}>Quantité manquante</span>
                            <span style={{color: "var(--text-muted)", fontSize:"0.85rem"}}>{deckContext.isSideboard ? "(Réserve)" : "(Principal)"}</span>
                        </div>
                        <span style={{ color: "var(--danger)", fontSize: "1.4rem", fontWeight: "bold" }}>x{deckContext.quantity}</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={deckContext.onRemove} className="btn-primary" style={{ flex: 1, padding: "8px", fontWeight: "bold", fontSize: "1.2rem", background: "var(--danger)", borderColor: "var(--danger)" }}>-</button>
                        <button onClick={deckContext.onAdd} className="btn-primary" style={{ flex: 1, padding: "8px", fontWeight: "bold", fontSize: "1.2rem" }}>+</button>
                    </div>
                    {deckContext.quantity === 1 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px", textAlign: "center" }}>
                            (Retirer passera à la suivante)
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* Indication Collection */}
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "15px" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                 <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>En collection :</span>
                 <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "var(--danger)" }}>0</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}