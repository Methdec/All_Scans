import React, { useEffect, useState } from "react";
import Loader from "./Loader"; 
import "../theme.css"; 

const PRIMARY_ORANGE = "#FF9800";
const BG_MAIN = "#121212"; 
const FORMATS = ["standard", "commander", "modern", "pioneer", "legacy", "vintage", "pauper"];
const DEFAULT_CARD_BACK = "https://cards.scryfall.io/large/back/0/0.jpg";

function DeckPickerModal({ onClose, onSelect }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("standard");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch("http://localhost:8000/items/all_lists_and_decks", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setDecks(data.items || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchDecks();
  }, []);

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("http://localhost:8000/items", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ nom: newDeckName, type: "deck", format: newDeckFormat, parent_id: null })
      });
      if (res.ok) {
        const data = await res.json();
        onSelect(data.id);
      }
    } catch (err) { console.error(err); } finally { setIsCreating(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: "450px", flexDirection: "column", padding: "0", background: "var(--bg-main, #121212)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, color: "var(--text-main)", fontSize: "1.2rem" }}>Ajouter au deck...</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}>X</button>
        </div>
        <div style={{ maxHeight: "400px", overflowY: "auto", padding: "10px" }}>
          {loading ? <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>Chargement des decks...</div> : decks.length === 0 ? <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>Aucun deck trouve.</div> : decks.map(deck => (
              <div key={deck.id} onClick={() => onSelect(deck.id)} style={{ display: "flex", alignItems: "center", padding: "10px", borderRadius: "8px", cursor: "pointer", transition: "background 0.2s", marginBottom: "5px" }} onMouseOver={e => e.currentTarget.style.background = "var(--bg-input, #1e1e1e)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                <img src={deck.image || DEFAULT_CARD_BACK} alt="cover" style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "4px", marginRight: "15px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "1rem", marginBottom: "3px" }}>{deck.nom}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{deck.format} - {deck.cards ? deck.cards.length : 0} cartes</div>
                </div>
                <div style={{ color: "var(--primary, #FF9800)", fontSize: "1.5rem", fontWeight: "bold", padding: "0 10px" }}>+</div>
              </div>
            ))}
        </div>
        <div style={{ padding: "15px", borderTop: "1px solid var(--border)", background: "var(--bg-input, #1e1e1e)" }}>
          {!showCreateForm ? <button onClick={() => setShowCreateForm(true)} className="btn-secondary" style={{ width: "100%", padding: "12px", borderStyle: "dashed", borderColor: "var(--text-muted)", color: "var(--text-main)" }}>+ Creer un nouveau deck</button> : (
            <form onSubmit={handleCreateDeck} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="text" placeholder="Nom du deck..." value={newDeckName} onChange={e => setNewDeckName(e.target.value)} autoFocus style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <select value={newDeckFormat} onChange={e => setNewDeckFormat(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)" }}>
                  {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
                <button type="submit" className="btn-primary" disabled={isCreating || !newDeckName.trim()} style={{ flex: 1 }}>{isCreating ? "Creation..." : "Creer et Ajouter"}</button>
              </div>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "0.85rem", cursor: "pointer", marginTop: "5px", textDecoration: "underline" }}>Annuler</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CardModal({ cardId, isFoil, defaultCount, onClose, onNext, onPrev, hasNext, hasPrev, deckContext }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [editCount, setEditCount] = useState(1);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const [hasChanged, setHasChanged] = useState(false);
  const [notification, setNotification] = useState(null); 
  const [showDeckPicker, setShowDeckPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCard() {
      if (!cardId || typeof cardId !== "string") {
          setError("L'ID de la carte fourni a la modale est invalide.");
          setLoading(false);
          return;
      }

      setCard(null); 
      setError(null);
      setLoading(true);
      setImageLoading(true);
      setCurrentFaceIndex(0);
      setIsEditing(false);
      
      try {
        let foilQuery = "";
        if (isFoil === true) foilQuery = "?is_foil=true";
        else if (isFoil === false) foilQuery = "?is_foil=false";

        const cardRes = await fetch(`http://localhost:8000/cards/${cardId}${foilQuery}`, { credentials: "include" });
        if (!cardRes.ok) {
            const errData = await cardRes.json().catch(() => ({}));
            let errorMessage = errData.detail || "Impossible de charger la carte.";
            if (typeof errorMessage !== "string") errorMessage = JSON.stringify(errorMessage);
            throw new Error(errorMessage);
        }
        
        const cardData = await cardRes.json();
        if (!cancelled) {
          setCard(cardData);
          setEditCount(defaultCount !== undefined ? defaultCount : (cardData.count || 1));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCard();
    return () => { cancelled = true; };
  }, [cardId, isFoil, defaultCount]);

  const handleManualClose = () => onClose(hasChanged);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" && hasNext && !isEditing && !showDeckPicker) onNext();
      if (e.key === "ArrowLeft" && hasPrev && !isEditing && !showDeckPicker) onPrev();
      if (e.key === "Escape" && !showDeckPicker) handleManualClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev, isEditing, showDeckPicker, hasChanged]); 

  const handleAddToDeck = async (deckId) => {
    setShowDeckPicker(false);
    try {
      const res = await fetch(`http://localhost:8000/items/${deckId}/add_card`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ card_id: card?.id || card?._id || cardId, is_sideboard: false }),
      });
      if (!res.ok) throw new Error("Erreur ajout");
      
      setNotification({ type: "success", message: "Carte ajoutee au deck !" });
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
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: editCount, is_foil: !!isFoil }),
      });
      if (!res.ok) throw new Error("Erreur");
      
      setHasChanged(true); 
      setCard(prev => ({...prev, count: editCount}));
      setNotification({ type: "success", message: "Quantite mise a jour !" });
      setTimeout(() => { setNotification(null); setIsEditing(false); }, 1000);
    } catch (err) { setNotification({ type: "error", message: "Erreur serveur." }); }
  };

  const hasSeparateFaceImages = card?.card_faces && Array.isArray(card.card_faces) && card.card_faces.length > 1 && 
    card.card_faces.some(face => face?.image_uris?.normal || face?.image_uris?.border_crop);

  const handleFaceFlip = () => {
    if (!hasSeparateFaceImages || !card?.card_faces) return;
    setIsFlipping(true);
    setTimeout(() => { setCurrentFaceIndex((prev) => (prev + 1) % card.card_faces.length); setIsFlipping(false); }, 150);
  };

  const renderPrice = () => {
      if (!card?.prices) return "N/A";
      if (card.prices.eur) return <span style={{color: "#4CAF50", fontWeight:"bold"}}>{card.prices.eur} EUR</span>;
      if (card.prices.usd) return <span style={{color: "#4CAF50"}}>{card.prices.usd} USD</span>;
      return <span style={{color: "var(--text-muted)"}}>--</span>;
  };

  if (loading && !card && !error) return (
      <div className="modal-overlay" onClick={handleManualClose}>
          <div className="modal-box" style={{ justifyContent: "center", alignItems: "center", background: "transparent", boxShadow: "none" }} onClick={e => e.stopPropagation()}><Loader /></div>
      </div>
  );

  if (error) {
      return (
          <div className="modal-overlay" onClick={handleManualClose}>
              <div className="modal-content" style={{ width: "400px", padding: "30px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ color: "var(--danger)", marginTop: 0 }}>Erreur</h3>
                  <p style={{ color: "var(--text-main)", lineHeight: "1.5", wordBreak: "break-word" }}>{error}</p>
                  <button onClick={handleManualClose} className="btn-secondary" style={{ marginTop: "20px", width: "100%" }}>Fermer</button>
              </div>
          </div>
      );
  }

  if (!card) return null;

  let imageUrl = card.image_normal || card.image_border_crop || null;
  let displayedName = card.name || "Carte Inconnue";
  let displayedOracleText = card.oracle_text || "";

  if (hasSeparateFaceImages && card.card_faces) {
    const activeFace = card.card_faces[currentFaceIndex];
    imageUrl = activeFace?.image_uris?.normal || activeFace?.image_uris?.border_crop || imageUrl;
    displayedName = activeFace?.name || displayedName;
    displayedOracleText = activeFace?.oracle_text || "";
  } else if (!displayedOracleText && card.card_faces && Array.isArray(card.card_faces)) {
    displayedOracleText = card.card_faces.map(face => face?.oracle_text || "").join("\n\n//\n\n");
  }

  const navButtonStyle = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", background: PRIMARY_ORANGE, color: BG_MAIN, border: "none", borderRadius: "50%",
    width: "60px", height: "60px", fontSize: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
  };
  const closeButtonStyle = {
    position: "absolute", top: "-15px", right: "-15px", background: PRIMARY_ORANGE, color: "white", border: `3px solid ${BG_MAIN}`, display: "flex", alignItems: "center",
    justifyContent: "center", padding: 0, width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", fontWeight: "bold", fontSize: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.5)", transition: "all 0.2s", zIndex: 20
  };

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && handleManualClose()}>
      
      {/* NOUVEAU LAYOUT : 1100px de large pour 3 colonnes */}
      <div className="modal-content" style={{ display: "flex", gap: "25px", width: "1100px", maxWidth: "95%", padding: "30px", position: "relative", overflow: "visible" }}>
        
        <button onClick={handleManualClose} style={closeButtonStyle} onMouseOver={(e) => e.target.style.background = "#e68a00"} onMouseOut={(e) => e.target.style.background = PRIMARY_ORANGE} title="Fermer">X</button>

        {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} style={{ ...navButtonStyle, left: "-80px" }} onMouseOver={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = BG_MAIN; }} onMouseOut={(e) => { e.currentTarget.style.background = PRIMARY_ORANGE; e.currentTarget.style.color = BG_MAIN; }} title="Carte precedente">&#10094;</button>}
        {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{ ...navButtonStyle, right: "-80px" }} onMouseOver={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = BG_MAIN; }} onMouseOut={(e) => { e.currentTarget.style.background = PRIMARY_ORANGE; e.currentTarget.style.color = BG_MAIN; }} title="Carte suivante">&#10095;</button>}

        {/* COLONNE 1 : IMAGE (Fixe 300px) */}
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minHeight: "420px" }}>
          {imageLoading && imageUrl && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
              <Loader />
            </div>
          )}
          {imageUrl ? (
            <img 
              key={`${card?.id}_${isFoil}_${currentFaceIndex}`} src={imageUrl} alt={displayedName} onClick={handleFaceFlip} onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} 
              style={{ width: "100%", borderRadius: "4.75% / 3.5%", boxShadow: "0 10px 20px rgba(0,0,0,0.5)", cursor: hasSeparateFaceImages ? "pointer" : "default", transform: isFlipping ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)", opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "transform 0.15s, opacity 0.15s", zIndex: 1 }} 
            />
          ) : (
            <div style={{ width: "100%", height: "420px", background: "var(--bg-input)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Image indisponible</div>
          )}
          {hasSeparateFaceImages && (
            <button onClick={handleFaceFlip} style={{ marginTop: "15px", padding: "8px 15px", background: "transparent", border: "1px solid var(--primary, #FF9800)", color: "var(--primary, #FF9800)", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", width: "100%", transition: "all 0.2s" }} onMouseOver={(e) => { e.target.style.background = "var(--primary, #FF9800)"; e.target.style.color = "white"; }} onMouseOut={(e) => { e.target.style.background = "transparent"; e.target.style.color = "var(--primary, #FF9800)"; }}>Retourner la carte</button>
          )}
        </div>

        {/* COLONNE 2 : INFOS & TEXTE (Flexible) */}
        <div style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          <h2 style={{ margin: "0 0 10px 0", color: "var(--primary, #FF9800)", fontSize: "1.8rem", lineHeight: 1.2, opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "opacity 0.15s", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {displayedName}
            {isFoil === true && (
                <span style={{ background: "linear-gradient(45deg, #FFD700, #FF9800)", color: "#121212", fontSize: "0.85rem", fontWeight: "bold", padding: "4px 8px", borderRadius: "6px", verticalAlign: "middle" }}>[F] Foil</span>
            )}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "15px 0", borderTop: "1px solid var(--border, #eaeaea)", borderBottom: "1px solid var(--border, #eaeaea)", marginBottom: "15px", color: "var(--text-muted, #666)", fontSize: "0.95rem" }}>
            <div><strong>Set :</strong> {card.set_name || "?"} ({card.set?.toUpperCase() || "?"} #{card.collector_number || "?"})</div>
            <div><strong>Langue :</strong> {card.lang?.toUpperCase() || "EN"}</div>
            <div><strong>Prix estimé :</strong> <span style={{ fontSize: "1.1rem", marginLeft: "5px" }}>{renderPrice()}</span></div>
          </div>

          <div style={{ flex: 1, color: "var(--text-main, #333)", lineHeight: 1.6, fontSize: "1rem", overflowY: "auto", opacity: (isFlipping || imageLoading) ? 0 : 1, transition: "opacity 0.15s", paddingRight: "10px" }}>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{displayedOracleText || "Aucun texte pour cette face."}</p>
          </div>

        </div>

        {/* COLONNE 3 : ACTIONS (Fixe 280px) */}
        <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "25px", borderLeft: "1px solid var(--border)", paddingLeft: "25px" }}>
          
          {/* Bloc Achat */}
          {card.purchase_uris && (Object.keys(card.purchase_uris).length > 0) && (
              <div>
                  <h4 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "1.1rem" }}>Acheter</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {card.purchase_uris.cardmarket && <a href={card.purchase_uris.cardmarket} target="_blank" rel="noopener noreferrer" style={{ background: "#003b8e", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>Cardmarket</a>}
                      {card.purchase_uris.tcgplayer && <a href={card.purchase_uris.tcgplayer} target="_blank" rel="noopener noreferrer" style={{ background: "#1c52a3", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>TCGPlayer</a>}
                      {card.purchase_uris.cardhoarder && <a href={card.purchase_uris.cardhoarder} target="_blank" rel="noopener noreferrer" style={{ background: "#ff6f00", color: "white", padding: "10px 15px", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem", textAlign: "center", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.8} onMouseOut={e=>e.target.style.opacity=1}>Cardhoarder</a>}
                  </div>
              </div>
          )}

          {/* Bloc Contexte Deck */}
          {deckContext && (
            <div>
                <h4 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontSize: "1.1rem" }}>Gestion du Deck</h4>
                <div style={{ padding: "15px", background: "rgba(255, 152, 0, 0.05)", border: "1px solid var(--primary)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "bold", color: "var(--text-main)" }}>Quantité</span>
                            <span style={{color: "var(--text-muted)", fontSize:"0.85rem"}}>{deckContext.isSideboard ? "(Réserve)" : "(Principal)"}</span>
                        </div>
                        <span style={{ color: "var(--primary)", fontSize: "1.4rem", fontWeight: "bold" }}>x{deckContext.quantity}</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={deckContext.onRemove} className="btn-primary" style={{ flex: 1, padding: "8px", fontWeight: "bold", fontSize: "1.2rem" }}>-</button>
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

          {/* Bloc Collection */}
          <div style={{ marginTop: "auto" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "1.1rem", paddingTop: "15px", borderTop: "1px solid var(--border)" }}>Collection</h4>
              
              <div style={{ marginBottom: "15px" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "5px" }}>Possédés :</div>
                  
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 5 }}>
                        <input type="number" min="0" value={editCount} onChange={(e) => setEditCount(parseInt(e.target.value) || 0)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
                        <button onClick={handleUpdateCount} className="btn-primary" style={{ padding: "8px 12px", borderRadius: "4px" }}>OK</button>
                        <button onClick={() => setIsEditing(false)} className="btn-secondary" style={{ padding: "8px 12px", borderRadius: "4px" }}>X</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "var(--text-main)" }}>x{defaultCount !== undefined ? defaultCount : (card.count || 0)}</span>
                        <button onClick={() => setIsEditing(true)} style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", textDecoration: "underline", fontSize: "0.85rem" }}>Modifier</button>
                    </div>
                  )}
              </div>

              {!deckContext && (
                <button onClick={() => setShowDeckPicker(true)} className="btn-primary" style={{ width: "100%", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem" }}>
                  Ajouter a un deck...
                </button>
              )}
          </div>

        </div>

        {notification && (
            <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: notification.type === "error" ? "var(--danger)" : "var(--success)", color: "white", padding: "10px 20px", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "bold", zIndex: 9999 }}>
                {notification.message}
            </div>
        )}
      </div>
    </div>

    {showDeckPicker && (
        <DeckPickerModal onClose={() => setShowDeckPicker(false)} onSelect={handleAddToDeck} />
    )}
    </>
  );
}