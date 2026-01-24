import React, { useEffect, useState } from "react";
import Loader from "./Loader"; 
import "../theme.css"; 

export default function CardModal({ cardId, onClose }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editCount, setEditCount] = useState(1);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  
  const [hasChanged, setHasChanged] = useState(false);
  const [notification, setNotification] = useState(null); 

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError("");
      try {
        const cardRes = await fetch(`http://localhost:8000/cards/${cardId}`, { credentials: "include" });
        if (!cardRes.ok) throw new Error("Impossible de charger la carte");
        const cardData = await cardRes.json();
        
        // C'est cet appel qui va enfin marcher grâce à la correction backend
        const itemsRes = await fetch("http://localhost:8000/items/all_lists_and_decks", { credentials: "include" });
        const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };

        if (!cancelled) {
          setCard(cardData);
          setEditCount(cardData.count || 1);
          setItems(itemsData.items || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [cardId]);

  const handleAddCard = async () => {
    if (!selectedItem) {
      setNotification({ type: "error", message: "Sélectionne un deck d'abord." });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    try {
      // On envoie l'ID (MongoDB ou Scryfall), le backend se chargera de trier
      const res = await fetch(`http://localhost:8000/items/${selectedItem}/add_card`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id || card._id || cardId }),
      });
      if (!res.ok) throw new Error("Erreur ajout");
      
      setNotification({ type: "success", message: "Carte ajoutée !" });
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

  if (loading) return (
      <div className="modal-overlay">
          <div className="modal-box" style={{ justifyContent: "center", alignItems: "center" }}>
              <Loader />
          </div>
      </div>
  );

  if (error || !card) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && handleManualClose()}>
      <div className="modal-box">
        
        <button onClick={handleManualClose} className="modal-close-btn">Fermer</button>

        {/* Colonne Gauche : Image */}
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

        {/* Colonne Droite : Infos */}
        <div className="modal-right">
            <h2 style={{ marginTop: 0, color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "15px" }}>
              {card.name}
            </h2>
            
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
                        <input 
                          type="number" 
                          min="0" 
                          value={editCount} 
                          onChange={(e) => setEditCount(parseInt(e.target.value) || 0)} 
                          style={{ width: 60, padding: 5, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} 
                        />
                        <button onClick={handleUpdateCount} className="btn-primary" style={{ padding: "5px 10px" }}>OK</button>
                        <button onClick={() => setIsEditing(false)} className="btn-secondary" style={{ padding: "5px 10px" }}>X</button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="btn-secondary" style={{ fontSize: "0.85rem" }}>
                      Modifier
                    </button>
                  )}
              </div>

              <label style={{ display: "block", marginBottom: 6, color: "var(--text-muted)", fontSize: "0.9rem" }}>Ajouter à un deck :</label>
              <div style={{ display: "flex", gap: 10 }}>
                <select 
                  value={selectedItem} 
                  onChange={(e) => setSelectedItem(e.target.value)} 
                  style={{ flex: 1, padding: 10, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }}
                >
                  <option value="">-- Choisir un deck --</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.nom} ({item.type})</option>
                  ))}
                </select>
                <button onClick={handleAddCard} className="btn-primary" disabled={!selectedItem}>Ajouter</button>
              </div>
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
  );
}