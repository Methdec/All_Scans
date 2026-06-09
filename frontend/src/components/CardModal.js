import React, { useEffect, useState } from "react";
import Loader from "./Loader"; 
import "../theme.css"; 
import { API_BASE_URL } from '../utils/api';

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
        const res = await fetch(`${API_BASE_URL}/items/all_lists_and_decks`, { credentials: "include" });
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
      const res = await fetch(`${API_BASE_URL}/items`, {
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
      <div className="modal-box deck-picker-box" onClick={e => e.stopPropagation()}>
        <div className="deck-picker-header">
          <h3 className="m-0 text-lg">Ajouter au deck...</h3>
          <button onClick={onClose} className="btn-close-transparent">X</button>
        </div>
        <div className="deck-picker-list">
          {loading ? (
            <div className="text-center p-20" style={{ color: "var(--text-muted)" }}>Chargement des decks...</div>
          ) : decks.length === 0 ? (
            <div className="text-center p-20" style={{ color: "var(--text-muted)" }}>Aucun deck trouvé.</div>
          ) : decks.map(deck => (
              <div key={deck.id} onClick={() => onSelect(deck.id)} className="deck-picker-item">
                <img src={deck.image || DEFAULT_CARD_BACK} alt="cover" className="deck-picker-img" />
                <div className="flex-1">
                  <div className="font-bold mb-3">{deck.nom}</div>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>{deck.format} - {deck.cards ? deck.cards.length : 0} cartes</div>
                </div>
                <div className="text-xl font-bold px-10" style={{ color: "var(--primary)" }}>+</div>
              </div>
            ))}
        </div>
        <div className="deck-picker-footer">
          {!showCreateForm ? (
            <button onClick={() => setShowCreateForm(true)} className="btn-secondary w-full p-12 btn-dashed">
              + Créer un nouveau deck
            </button>
          ) : (
            <form onSubmit={handleCreateDeck} className="flex flex-col gap-10">
              <input 
                type="text" 
                placeholder="Nom du deck..." 
                value={newDeckName} 
                onChange={e => setNewDeckName(e.target.value)} 
                autoFocus 
                className="input-field" 
              />
              <div className="flex gap-10">
                <select 
                  value={newDeckFormat} 
                  onChange={e => setNewDeckFormat(e.target.value)} 
                  className="input-field flex-1"
                >
                  {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
                <button type="submit" className="btn-primary flex-1" disabled={isCreating || !newDeckName.trim()}>
                  {isCreating ? "Création..." : "Créer et Ajouter"}
                </button>
              </div>
              <button type="button" onClick={() => setShowCreateForm(false)} className="btn-link-cancel mt-5">
                Annuler
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CardModal({ cardId, isFoil, defaultCount, onClose, onNext, onPrev, hasNext, hasPrev, deckContext, tagColors = {} }) {
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

  const [newTag, setNewTag] = useState("");
  const [isTagging, setIsTagging] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);

  const [reprints, setReprints] = useState([]);
  const [showReprints, setShowReprints] = useState(false);
  const [loadingReprints, setLoadingReprints] = useState(false);

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
      setNewTag("");
      setShowReprints(false);
      setReprints([]);
      
      try {
        let foilQuery = "";
        if (isFoil === true) foilQuery = "?is_foil=true";
        else if (isFoil === false) foilQuery = "?is_foil=false";

        const cardRes = await fetch(`${API_BASE_URL}/cards/${cardId}${foilQuery}`, { credentials: "include" });
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
      const res = await fetch(`${API_BASE_URL}/items/${deckId}/add_card`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ card_id: card?.id || card?._id || cardId, is_sideboard: false }),
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
      const res = await fetch(`${API_BASE_URL}/usercards/${cardId}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: editCount, is_foil: !!isFoil }),
      });
      if (!res.ok) throw new Error("Erreur");
      
      setHasChanged(true); 
      setCard(prev => ({...prev, count: editCount}));
      setNotification({ type: "success", message: "Quantité mise à jour !" });
      setTimeout(() => { setNotification(null); setIsEditing(false); }, 1000);
    } catch (err) { setNotification({ type: "error", message: "Erreur serveur." }); }
  };

  useEffect(() => {
      const loadTags = async () => {
          try {
              const res = await fetch(`${API_BASE_URL}/me/collection/tags`, { credentials: "include" });
              if (res.ok) {
                  const data = await res.json();
                  setAvailableTags(data.tags || []);
              }
          } catch (err) {}
      };
      if (card) loadTags();
  }, [card]);

  const handleAddTag = async (e) => {
      e.preventDefault();
      if (!newTag.trim()) return;
      setIsTagging(true);
      
      try {
          const res = await fetch(`${API_BASE_URL}/${cardId}/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tag: newTag.trim() })
          });
          
          if (res.ok) {
              const data = await res.json();
              setCard(prev => ({ ...prev, tags: [...(prev.tags || []), data.tag] }));
              setNewTag("");
              setHasChanged(true); 
          } else {
              setNotification({ type: "error", message: "Erreur lors de l'ajout du tag." });
              setTimeout(() => setNotification(null), 3000);
          }
      } catch (err) {
          setNotification({ type: "error", message: "Erreur de communication." });
          setTimeout(() => setNotification(null), 3000);
      } finally {
          setIsTagging(false);
      }
  };

  const handleRemoveTag = async (tagToRemove) => {
      try {
          const res = await fetch(`${API_BASE_URL}/${cardId}/tags?tag=${encodeURIComponent(tagToRemove)}`, {
              method: "DELETE",
              credentials: "include"
          });
          
          if (res.ok) {
              setCard(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
              setHasChanged(true);
          } else {
              setNotification({ type: "error", message: "Erreur lors de la suppression." });
              setTimeout(() => setNotification(null), 3000);
          }
      } catch (err) {
          setNotification({ type: "error", message: "Erreur de communication." });
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const fetchReprints = async () => {
    if (showReprints) {
       setShowReprints(false);
       return;
    }
    if (!card || !card.oracle_id) return;
    
    setShowReprints(true);
    setLoadingReprints(true);
    try {
       const res = await fetch(`${API_BASE_URL}/cards/prints/${card.oracle_id}`, { credentials: "include" });
       if (res.ok) {
          const data = await res.json();
          setReprints(data.prints || []);
       }
    } catch(e) {
       console.error(e);
    } finally {
       setLoadingReprints(false);
    }
  };

  const handleSwap = async (newCard) => {
    if (newCard.id === card.id) return; 

    if (!card.owned) {
        setNotification({type: "error", message: "Ajoutez d'abord la carte à votre collection."});
        setTimeout(() => setNotification(null), 3000);
        return;
    }

    try {
       let swapQty = isEditing ? parseInt(editCount) || 1 : 1;
       if (swapQty <= 0) return;

       const res = await fetch(`${API_BASE_URL}/usercards/${card.id}/swap`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          credentials: "include",
          body: JSON.stringify({
             new_card: newCard,
             quantity: swapQty,
             is_foil: !!isFoil
          })
       });

       if (res.ok) {
          setNotification({type: "success", message: "Version modifiée avec succès !"});
          setHasChanged(true);
          setTimeout(() => onClose(true), 1200); 
       } else {
          setNotification({type: "error", message: "Erreur lors de l'échange."});
          setTimeout(() => setNotification(null), 3000);
       }
    } catch(e) {
       setNotification({type: "error", message: "Erreur de connexion."});
       setTimeout(() => setNotification(null), 3000);
    }
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
      if (card.prices.eur) return <span className="font-bold" style={{color: "#4CAF50"}}>{card.prices.eur} EUR</span>;
      if (card.prices.usd) return <span style={{color: "#4CAF50"}}>{card.prices.usd} USD</span>;
      return <span style={{color: "var(--text-muted)"}}>--</span>;
  };

  if (loading && !card && !error) return (
      <div className="modal-overlay" onClick={handleManualClose}>
          <div className="modal-box justify-center items-center" style={{ background: "transparent", boxShadow: "none" }} onClick={e => e.stopPropagation()}>
            <Loader />
          </div>
      </div>
  );

  if (error) {
      return (
          <div className="modal-overlay" onClick={handleManualClose}>
              <div className="modal-content" style={{ width: "400px", padding: "30px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <h3 className="m-0 text-danger">Erreur</h3>
                  <p style={{ color: "var(--text-main)", lineHeight: "1.5", wordBreak: "break-word" }}>{error}</p>
                  <button onClick={handleManualClose} className="btn-secondary w-full mt-20">Fermer</button>
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

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && handleManualClose()}>
      
      <div className="modal-content card-modal-content">
        
        <button onClick={handleManualClose} className="card-close-btn" title="Fermer">X</button>

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
              key={`${card?.id}_${isFoil}_${currentFaceIndex}`} 
              src={imageUrl} 
              alt={displayedName} 
              onClick={handleFaceFlip} 
              onLoad={() => setImageLoading(false)} 
              onError={() => setImageLoading(false)} 
              className="card-img-large"
              style={{ 
                cursor: hasSeparateFaceImages ? "pointer" : "default", 
                transform: isFlipping ? "scale(0.95) rotateY(90deg)" : "scale(1) rotateY(0deg)", 
                opacity: (isFlipping || imageLoading) ? 0 : 1 
              }} 
            />
          ) : (
            <div className="card-placeholder">Image indisponible</div>
          )}
          {hasSeparateFaceImages && (
            <button onClick={handleFaceFlip} className="btn-outline-primary w-full mt-15 font-bold">Retourner la carte</button>
          )}
        </div>

        {/* COLONNE 2 : INFOS & TEXTE */}
        <div className="card-col-info">
          
          {/* TITRE PC UNIQUEMENT */}
          <h2 className="card-title-lg desktop-card-title" style={{ opacity: (isFlipping || imageLoading) ? 0 : 1 }}>
            {displayedName}
            {isFoil === true && <span className="foil-badge">[F] Foil</span>}
          </h2>

          <div className="card-details-section">
            <div className="set-link" onClick={fetchReprints} title="Cliquez pour voir les autres éditions">
                <span>
                    <strong style={{ color: "var(--text-muted)" }}>Set : </strong> 
                    <span style={{ textDecoration: "underline" }}>{card.set_name || "?"} ({card.set?.toUpperCase() || "?"} #{card.collector_number || "?"})</span>
                </span>
            </div>

            {/* GALERIE D'IMPRESSIONS */}
            {showReprints && (
                <div className="reprint-gallery">
                    {loadingReprints ? <div className="p-10 text-center w-full">Recherche des versions...</div> :
                     reprints.map(rp => (
                        <div 
                          key={rp.id} 
                          onClick={() => handleSwap(rp)} 
                          className={`reprint-item ${rp.id === card.id ? 'active' : ''}`}
                          title={`Basculer sur l'édition ${rp.set.toUpperCase()}`}
                        >
                           <img src={rp.image_normal || rp.image_border_crop || DEFAULT_CARD_BACK} className="reprint-item-img" alt={rp.set} />
                           <div className="reprint-item-text" style={{ color: rp.id === card.id ? "var(--primary)" : "var(--text-main)", fontWeight: rp.id === card.id ? "bold" : "normal" }}>
                             {rp.set.toUpperCase()} #{rp.collector_number}
                           </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-5"><strong>Langue :</strong> {card.lang?.toUpperCase() || "EN"}</div>
            <div><strong>Prix estimé :</strong> <span className="text-lg ml-5">{renderPrice()}</span></div>
          </div>

          <div className="oracle-text-container" style={{ opacity: (isFlipping || imageLoading) ? 0 : 1 }}>
            {displayedOracleText || "Aucun texte pour cette face."}
          </div>

        </div>

        {/* COLONNE 3 : ACTIONS */}
        <div className="card-col-actions">
          
          {card.purchase_uris && (Object.keys(card.purchase_uris).length > 0) && (
              <div>
                  <h4 className="m-0 mb-10 text-lg">Acheter</h4>
                  <div className="flex flex-col gap-8">
                      {card.purchase_uris.cardmarket && <a href={card.purchase_uris.cardmarket} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-cardmarket">Cardmarket</a>}
                      {card.purchase_uris.tcgplayer && <a href={card.purchase_uris.tcgplayer} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-tcgplayer">TCGPlayer</a>}
                      {card.purchase_uris.cardhoarder && <a href={card.purchase_uris.cardhoarder} target="_blank" rel="noopener noreferrer" className="buy-link-btn bg-cardhoarder">Cardhoarder</a>}
                  </div>
              </div>
          )}

          <div className="border-top">
              <span className="block mb-10 text-sm font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                  Tags appliqués
              </span>
              
              <div className="tags-container">
                  {card.tags && card.tags.length > 0 ? card.tags.map((tag, index) => {
                      const currentTagColor = tagColors[tag.toLowerCase()] || "var(--primary)";
                      return (
                          <div key={index} className="tag-badge" style={{ color: currentTagColor, border: `1px solid ${currentTagColor}` }}>
                              {tag}
                              <button onClick={() => handleRemoveTag(tag)} className="tag-remove-btn" title="Supprimer ce tag">✕</button>
                          </div>
                      );
                  }) : (
                      <div className="text-sm italic" style={{ color: "var(--text-muted)" }}>Aucun tag.</div>
                  )}
              </div>

              <form onSubmit={handleAddTag} className="flex gap-8">
                  <input 
                      type="text" 
                      list="modal-available-tags"
                      value={newTag} 
                      onChange={(e) => setNewTag(e.target.value)} 
                      placeholder="Ajouter un tag..." 
                      className="input-field flex-1"
                  />
                  <button type="submit" disabled={!newTag.trim() || isTagging} className="btn-primary font-bold">
                      +
                  </button>
              </form>
          </div>

          {deckContext && (
            <div>
                <h4 className="m-0 mb-10 text-lg border-top" style={{ color: "var(--primary)" }}>Gestion du Deck</h4>
                <div className="deck-mgmt-box">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex flex-col">
                            <span className="font-bold">Quantité</span>
                            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{deckContext.isSideboard ? "(Réserve)" : "(Principal)"}</span>
                        </div>
                        <span className="text-2xl font-bold" style={{ color: "var(--primary)" }}>x{deckContext.quantity}</span>
                    </div>
                    <div className="flex gap-10">
                        <button onClick={deckContext.onRemove} className="btn-primary flex-1 font-bold text-xl p-8">-</button>
                        <button onClick={deckContext.onAdd} className="btn-primary flex-1 font-bold text-xl p-8">+</button>
                    </div>
                    {deckContext.quantity === 1 && (
                        <div className="text-sm mt-8 text-center" style={{ color: "var(--text-muted)" }}>
                            (Retirer passera à la suivante)
                        </div>
                    )}
                </div>
            </div>
          )}

          <div className="mt-auto">
              <h4 className="m-0 mb-10 text-lg border-top">Collection</h4>
              
              <div className="mb-15">
                  <div className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>Possédés :</div>
                  
                  {isEditing ? (
                    <div className="flex gap-5">
                        <input type="number" min="0" value={editCount} onChange={(e) => setEditCount(parseInt(e.target.value) || 0)} className="input-field w-full" />
                        <button onClick={handleUpdateCount} className="btn-primary">OK</button>
                        <button onClick={() => setIsEditing(false)} className="btn-secondary">X</button>
                    </div>
                  ) : (
                    <div className="collection-mgmt-row">
                        <span className="collection-qty">x{defaultCount !== undefined ? defaultCount : (card.count || 0)}</span>
                        <button onClick={() => setIsEditing(true)} className="btn-edit-qty">Modifier</button>
                    </div>
                  )}
              </div>

              {!deckContext && (
                <button onClick={() => setShowDeckPicker(true)} className="btn-primary w-full p-12 font-bold text-lg">
                  Ajouter à un deck...
                </button>
              )}
          </div>

        </div>

        {notification && (
            <div className={`toast-notification ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
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