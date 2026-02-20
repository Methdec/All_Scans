import React, { useEffect, useState } from "react";
import Loader from "./Loader"; 
import DeckPickerModal from "./DeckPickerModal"; // ✅ IMPORT
import "../theme.css"; 

export default function CardModal({ cardId, onClose }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // States d'édition locale
  const [isEditing, setIsEditing] = useState(false);
  const [editCount, setEditCount] = useState(1);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  
  const [hasChanged, setHasChanged] = useState(false);
  const [notification, setNotification] = useState(null); 

  // ✅ Nouveau State pour la modale de choix de deck
  const [showDeckPicker, setShowDeckPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCard() {
      setLoading(true);
      try {
        const cardRes = await fetch(`http://localhost:8000/cards/${cardId}`, { credentials: "include" });
        if (!cardRes.ok) throw new Error("Impossible de charger la carte");
        const cardData = await cardRes.json();
        
        if (!cancelled) {
          setCard(cardData);
          setEditCount(cardData.count || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCard();
    return () => { cancelled = true; };
  }, [cardId]);

  // ✅ Fonction appelée quand on clique sur un deck dans la liste
  const handleAddToDeck = async (deckId) => {
    // 1. Fermer le picker immédiatement pour fluidité
    setShowDeckPicker(false);

    try {
      const res = await fetch(`http://localhost:8000/items/${deckId}/add_card`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id || card._id || cardId }),
      });
      if (!res.ok) throw new Error("Erreur ajout");
      
      setNotification({ type: "success", message: "Carte ajoutée au deck !" });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: "error", message: "Erreur serveur." });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleUpdateCount = async () => {
    if (editCount < 0) return;
    try {
      const res = await fetch(`http://localhost:8000/usercards/${cardId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: editCount }),
      });
      if (!res.ok) throw new Error("Erreur");
      
      setHasChanged(true); 
      setNotification({ type: "success", message: "Quantité mise à jour !" });
      
      setTimeout(() => {
          setNotification(null);
          setIsEditing(false);
          onClose(true); 
      }, 1000);

    } catch (err) {
      setNotification({ type: "error", message: "Erreur serveur." });
    }
  };

  const hasSeparateFaceImages = card?.card_faces && card.card_faces.length > 1 && 
    card.card_faces.some(face => face.image_uris?.normal || face.image_uris?.border_crop);

  const handleFaceFlip = () => {
    if (!hasSeparateFaceImages) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentFaceIndex((prev) => (prev + 1) % card.card_faces.length);
      setIsFlipping(false);
    }, 150);
  };

  const handleManualClose = () => {
      onClose(hasChanged);
  };

  const renderPrice = () => {
      if (!card.prices) return null;
      if (card.prices.eur) return <span style={{color: "var(--success)", fontWeight:"bold"}}>{card.prices.eur} €</span>;
      if (card.prices.usd) return <span style={{color: "var(--success)"}}>{card.prices.usd} $</span>;
      return <span style={{color: "var(--text-muted)"}}>--</span>;
  };

  if (loading) return (
      <div className="modal-overlay">
          <div className="modal-box" style={{ justifyContent: "center", alignItems: "center" }}>
              <Loader />
          </div>
      </div>
  );

  if (error || !card) return null;

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && handleManualClose()}>
      <div className="modal-box">
        
        <button onClick={handleManualClose} className="modal-close-btn">Fermer</button>

        <div className="modal-left">
          {hasSeparateFaceImages ? (
            <div style={{ textAlign: "center" }}>
              <div onClick={handleFaceFlip} style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
                <img
                  src={card.card_faces[currentFaceIndex]?.image_uris?.normal || card.card_faces[currentFaceIndex]?.image_uris?.border_crop}
                  alt={card.name}
                  className="modal-image"
                  style={{ 
                    transform: isFlipping ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)", 
                    opacity: isFlipping ? 0.7 : 1, 
                    transition: "transform 0.15s, opacity 0.15s" 
                  }}
                />
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", color: "white", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                  {currentFaceIndex + 1}/{card.card_faces.length}
                </div>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>Cliquez pour retourner</p>
            </div>
          ) : (
            <img src={card.image_normal || card.image_border_crop} alt={card.name} className="modal-image" />
          )}
        </div>

        <div className="modal-right">
            <h2 style={{ marginTop: 0, color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "10px" }}>
              {card.name}
            </h2>
            
            <div style={{ display: "flex", gap: "15px", fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                <div><strong>Set:</strong> {card.set_name} <span style={{opacity:0.7}}>({card.set?.toUpperCase()} #{card.collector_number})</span></div>
                <div><strong>Langue:</strong> {card.lang?.toUpperCase()}</div>
                <div><strong>Prix:</strong> {renderPrice()}</div>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto" }}>
              {hasSeparateFaceImages ? (
                  <div style={{ color: "var(--text-main)" }}>
                    <h3 style={{marginTop: 15, color: "var(--text-muted)"}}>{card.card_faces[currentFaceIndex].name}</h3>
                    <p style={{whiteSpace:"pre-wrap", lineHeight: 1.6}}>{card.card_faces[currentFaceIndex].oracle_text}</p>
                  </div>
              ) : (
                  <div style={{ color: "var(--text-main)" }}>
                    <p style={{whiteSpace:"pre-wrap", lineHeight: 1.6}}>{card.oracle_text}</p>
                  </div>
              )}
            </div>

            <div className="modal-footer">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }}>
                  <span style={{ fontWeight: "bold" }}>Exemplaires : {card.count || 1}</span>
                  
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 5 }}>
                        <input type="number" min="0" value={editCount} onChange={(e) => setEditCount(parseInt(e.target.value) || 0)} style={{ width: 60, padding: 5, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
                        <button onClick={handleUpdateCount} className="btn-primary" style={{ padding: "5px 10px" }}>OK</button>
                        <button onClick={() => setIsEditing(false)} className="btn-secondary" style={{ padding: "5px 10px" }}>X</button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="btn-secondary" style={{ fontSize: "0.85rem" }}>Modifier</button>
                  )}
              </div>

              {/* ✅ NOUVEAU BOUTON AJOUT */}
              <button 
                onClick={() => setShowDeckPicker(true)} 
                className="btn-primary" 
                style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}
              >
                <span>🃏</span> Ajouter à un deck...
              </button>

            </div>
        </div>

        {notification && (
            <div style={{
                position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)",
                background: notification.type === "error" ? "var(--danger)" : "var(--success)",
                color: "white", padding: "10px 20px", borderRadius: "var(--radius)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "bold", zIndex: 100
            }}>
                {notification.message}
            </div>
        )}
      </div>
    </div>

    {/* ✅ MODALE DE SÉLECTION DE DECK (s'affiche par dessus) */}
    {showDeckPicker && (
        <DeckPickerModal 
            onClose={() => setShowDeckPicker(false)} 
            onSelect={handleAddToDeck} 
        />
    )}
    </>
  );
}