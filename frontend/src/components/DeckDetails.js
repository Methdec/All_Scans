import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { validateDeck } from "../utils/deckRules";
import CardModal from "./CardModal";
import CardSearchDetailModal from "./CardSearchDetailModal";
import DeckStats from "./DeckStats";
import DeckSettings from "./DeckSettings";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

const DEFAULT_CARD_BACK = "https://cards.scryfall.io/large/back/0/0.jpg";

// L'ordre de ce tableau est important pour le tri des types multiples
const TYPE_PRIORITY = [
  "Creature", "Planeswalker", "Instant", "Sorcery", 
  "Enchantment", "Artifact", "Battle", "Land", "Other", "Sideboard"
];

const TYPE_TRANSLATIONS = {
  Creature: "Créatures", Planeswalker: "Planeswalkers", Instant: "Éphémères",
  Sorcery: "Rituels", Enchantment: "Enchantements", Artifact: "Artefacts",
  Battle: "Batailles", Land: "Terrains", Other: "Autres", Sideboard: "Réserve (Sideboard)"
};

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  const [selectedCard, setSelectedCard] = useState(null); 
  const [activeTab, setActiveTab] = useState("cards");

  const fetchDeck = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/items/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Deck introuvable");
      const data = await res.json();
      setDeck(data);
      
      if (data.type === "deck") {
        const valRes = validateDeck(data.format, data.cards || []);
        setValidation(valRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDeck(); }, [fetchDeck]);
  
  useEffect(() => {
    if (deck) {
      const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
      const isAlreadyOpen = storedDecks.some(d => d.id === deck.id);
      
      if (!isAlreadyOpen) {
        const updatedDecks = [...storedDecks, { id: deck.id, name: deck.nom }];
        localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
        window.dispatchEvent(new Event("decksUpdated"));
      }
    }
  }, [deck]);

  const updateQuantity = async (e, cardId, action, isSideboard = false) => {
    e.stopPropagation(); 
    try {
        const endpoint = action === "add" ? "add_card" : "remove_card";
        await fetch(`${API_BASE_URL}/items/${id}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ card_id: cardId, is_sideboard: isSideboard })
        });
        fetchDeck();
    } catch (err) {
        console.error("Erreur update quantité", err);
    }
  };

  const toggleBoard = async (e, cardId, isCurrentlySideboard) => {
      e.stopPropagation();
      try {
          await fetch(`${API_BASE_URL}/items/${id}/toggle_board`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ card_id: cardId, from_sideboard: isCurrentlySideboard })
          });
          fetchDeck();
      } catch (err) {
          console.error("Erreur toggle board", err);
      }
  };

  const toggleCommander = async (e, cardId, isCurrentlyCommander) => {
      e.stopPropagation();
      try {
          await fetch(`${API_BASE_URL}/items/${id}/toggle_commander`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ card_id: cardId, is_commander: !isCurrentlyCommander })
          });
          fetchDeck();
      } catch (err) {
          console.error("Erreur toggle commander", err);
      }
  };

  const getCardCategory = (typeLine) => {
    if (!typeLine) return "Other";
    const ignored = ["legendary", "basic", "snow", "world", "tribal"];
    const mainTypeString = typeLine.split("—")[0].split("-")[0].trim();
    const types = mainTypeString.split(" ");
    
    let bestType = "Other";
    let bestPriorityIndex = 999; 

    for (let t of types) {
        if (ignored.includes(t.toLowerCase())) continue;
        const cleanType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        
        const priorityIdx = TYPE_PRIORITY.indexOf(cleanType);
        if (priorityIdx !== -1 && priorityIdx < bestPriorityIndex) {
            bestPriorityIndex = priorityIdx;
            bestType = cleanType;
        }
    }
    
    return bestType;
  };

  const groupedCards = useMemo(() => {
    if (!deck || !deck.cards) return {};
    const groups = {};
    const isCommanderFormat = deck.format === "commander";

    deck.cards.forEach(card => {
        let cat;
        if (isCommanderFormat && card.is_commander) {
            cat = "Commander";
        } else if (card.is_sideboard) {
            cat = "Sideboard";
        } else {
            const typeLine = card.type_line || "Other";
            cat = getCardCategory(typeLine);
        }
        
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(card);
    });
    
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });
    return groups;
  }, [deck]);

  const navigationList = useMemo(() => {
    const list = [];
    const isCommanderFormat = deck?.format === "commander";
    
    if (isCommanderFormat && groupedCards["Commander"]) {
        groupedCards["Commander"].forEach(card => {
            list.push({ ...card, isMissing: card.owned_count < card.quantity });
        });
    }

    TYPE_PRIORITY.forEach(typeKey => {
        if (groupedCards[typeKey]) {
            groupedCards[typeKey].forEach(card => {
                list.push({ ...card, isMissing: card.owned_count < card.quantity });
            });
        }
    });
    return list;
  }, [groupedCards, deck]);

  const selectedIndex = navigationList.findIndex(c => 
      selectedCard && c.card_id === selectedCard.id && c.is_sideboard === selectedCard.isSideboard
  );

  const hasPrevCard = selectedIndex > 0;
  const hasNextCard = selectedIndex !== -1 && selectedIndex < navigationList.length - 1;

  const handlePrevCard = () => {
      if (hasPrevCard) {
          const prev = navigationList[selectedIndex - 1];
          setSelectedCard({ id: prev.card_id, isMissing: prev.isMissing, isSideboard: prev.is_sideboard, deckQuantity: prev.quantity });
      }
  };

  const handleNextCard = () => {
      if (hasNextCard) {
          const next = navigationList[selectedIndex + 1];
          setSelectedCard({ id: next.card_id, isMissing: next.isMissing, isSideboard: next.is_sideboard, deckQuantity: next.quantity });
      }
  };

  const handleModalDeckQuantityChange = async (action) => {
      if (!selectedCard) return;
      const { id, isSideboard, deckQuantity } = selectedCard;
      
      if (action === "remove" && deckQuantity === 1) {
          if (hasNextCard) handleNextCard();
          else if (hasPrevCard) handlePrevCard();
          else setSelectedCard(null); 
      } else if (action === "add") {
          setSelectedCard(prev => ({ ...prev, deckQuantity: prev.deckQuantity + 1 }));
      } else if (action === "remove") {
          setSelectedCard(prev => ({ ...prev, deckQuantity: prev.deckQuantity - 1 }));
      }
      
      await updateQuantity({ stopPropagation: () => {} }, id, action, isSideboard);
  };

  const deckContext = {
      quantity: selectedCard?.deckQuantity,
      isSideboard: selectedCard?.isSideboard,
      onAdd: () => handleModalDeckQuantityChange('add'),
      onRemove: () => handleModalDeckQuantityChange('remove')
  };

  const { mainboardCount, sideboardCount } = useMemo(() => {
      if (!deck || !deck.cards) return { mainboardCount: 0, sideboardCount: 0 };
      return deck.cards.reduce((acc, card) => {
          if (card.is_sideboard) {
              acc.sideboardCount += (card.quantity || 1);
          } else {
              acc.mainboardCount += (card.quantity || 1);
          }
          return acc;
      }, { mainboardCount: 0, sideboardCount: 0 });
  }, [deck]);

  const renderManaCost = (cost) => {
    if (!cost) return "";
    const parts = cost.match(/\{[^}]+\}/g) || [];
    return (
        <div className="dd-mana-cost">
            {parts.map((part, index) => {
                const symbol = part.replace(/[{}]/g, "");
                if (!isNaN(symbol) || symbol === "X") {
                    return <span key={index} className="mana-generic">{symbol}</span>;
                }
                const cleanSymbol = symbol.replace("/", "").toUpperCase();
                return <img key={index} src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`} alt={symbol} className="mana-icon" />;
            })}
        </div>
    );
  };

  const handleBack = () => {
    if (deck) {
      const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
      const updatedDecks = storedDecks.filter(d => d.id !== deck.id);
      localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
      window.dispatchEvent(new Event("decksUpdated"));
    }
    navigate(-1); 
  };

  const handleUpdateImage = async (imgUrl) => {
    try {
        await fetch(`${API_BASE_URL}/items/${deck.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ image: imgUrl })
        });
        setDeck({ ...deck, image: imgUrl });
        setShowImageModal(false);
    } catch (e) { console.error(e); }
  };

  const renderCardRow = (card, idx, typeKey) => {
    const isMissing = card.owned_count < card.quantity;
    const missingQty = card.quantity - (card.owned_count || 0);
    const isCommanderFormat = deck.format === "commander";
    const canToggleBoard = !card.is_commander && (!isCommanderFormat || typeKey !== "Commander");
    
    const isLegendaryCreature = card.type_line && 
                                card.type_line.toLowerCase().includes("legendary") && 
                                card.type_line.toLowerCase().includes("creature");

    const isInvalid = validation && validation.invalidCardIds && validation.invalidCardIds.includes(card.card_id);

    return (
        <tr 
            key={idx} 
            className={`dd-row ${isMissing ? 'missing' : ''} ${isInvalid ? 'invalid' : ''}`}
            onClick={() => setSelectedCard({ id: card.card_id, isMissing, isSideboard: card.is_sideboard, deckQuantity: card.quantity })} 
        >
            <td className="dd-cell dd-cell-name" style={{ color: isMissing || isInvalid ? "var(--danger)" : "inherit" }}>
                {card.name || "Carte Fantôme"}
                {isMissing && (
                    <span className="dd-missing-badge">Manque x{missingQty}</span>
                )}
                {isInvalid && (
                    <svg className="dd-invalid-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                )}
            </td>
            <td className="dd-cell dd-cell-type">
                {card.type_line || "Inconnu"}
            </td>
            <td className="dd-cell">
                {typeKey === "Land" ? <span className="dd-set-text">{card.set_name || "N/A"}</span> : renderManaCost(card.mana_cost)}
            </td>
            <td className="dd-cell dd-cell-actions">
                <div className="dd-cell-actions">
                    {isCommanderFormat && isLegendaryCreature && (
                        <button 
                            onClick={(e) => toggleCommander(e, card.card_id, card.is_commander)} 
                            className={`dd-btn-cmd ${card.is_commander ? 'active' : ''}`}
                            title={card.is_commander ? "Retirer du commandement" : "Désigner comme commandant"} 
                        >
                            Cmd
                        </button>
                    )}

                    <button onClick={(e) => updateQuantity(e, card.card_id, "remove", card.is_sideboard)} className="dd-btn-circle">-</button>
                    <span className="dd-qty-text">{card.quantity}</span>
                    <button onClick={(e) => updateQuantity(e, card.card_id, "add", card.is_sideboard)} className="dd-btn-circle">+</button>
                    
                    {canToggleBoard && (
                        <button onClick={(e) => toggleBoard(e, card.card_id, card.is_sideboard)} className="dd-btn-board" title={card.is_sideboard ? "Déplacer vers le deck principal" : "Déplacer vers la réserve"}>
                            ⇌
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
  };

  if (loading) return <div className="p-20">Chargement...</div>;
  if (!deck) return null;

  return (
    <div className="dd-container">
      
      <div className="dd-header">
        <img 
            src={deck.image || DEFAULT_CARD_BACK} alt="Cover" 
            className="dd-cover-img"
            onClick={() => setShowImageModal(true)}
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_CARD_BACK; }} 
        />
        <div className="dd-header-info">
            <button onClick={handleBack} className="btn-secondary mb-10">Retour</button>
            <h1 className="dd-title">{deck.nom}</h1>
            <div className="dd-meta">
                <span>Format: <strong className="text-primary">{deck.format}</strong></span>
                <span>Cartes: <strong>{mainboardCount}</strong> principal / <strong>{sideboardCount}</strong> réserve</span>
            </div>
            
            {validation && !validation.isValid && (
                <div className="dd-invalid-alert">
                     <div className="dd-invalid-alert-header">
                        <span className="font-bold">Deck Invalide</span>
                        <span>{validation.errors ? validation.errors.length : 1} erreur(s)</span>
                     </div>
                     {activeTab !== 'stats' && (
                        <small className="dd-invalid-alert-link" onClick={() => setActiveTab('stats')}>
                            Voir les détails dans Statistiques
                        </small>
                     )}
                </div>
            )}
        </div>
      </div>

      <div className="dd-tabs-container">
          <div className={`dd-tab ${activeTab === 'cards' ? 'active' : ''}`} onClick={() => setActiveTab('cards')}>Cartes</div>
          <div className={`dd-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistiques & Erreurs</div>
          <div className={`dd-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Paramètres</div>
      </div>

      <div className="dd-content"> 
          
          {activeTab === 'cards' && (
            <div>
              {deck.format === "commander" && groupedCards["Commander"] && (
                  <div className="dd-commander-box">
                      <h3 className="dd-category-title dd-commander-title">
                          Zone de Commandement
                          <span className="dd-category-count">{groupedCards["Commander"].length}</span>
                      </h3>
                      <table className="dd-table">
                          <tbody>
                              {groupedCards["Commander"].map((card, idx) => renderCardRow(card, idx, "Commander"))}
                          </tbody>
                      </table>
                  </div>
              )}

              {TYPE_PRIORITY.map(typeKey => {
                  const cards = groupedCards[typeKey];
                  if (!cards || cards.length === 0) return null;
                  
                  const categoryCount = cards.reduce((acc, c) => acc + (c.quantity || 1), 0);

                  return (
                    <div key={typeKey} className="dd-category-block">
                        <h3 className="dd-category-title">
                            {TYPE_TRANSLATIONS[typeKey]}
                            <span className="dd-category-count">{categoryCount}</span>
                        </h3>
                        <table className="dd-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "35%" }}>Nom</th>
                                    <th style={{ width: "25%" }}>Type</th>
                                    <th style={{ width: "15%" }}>{typeKey === "Land" ? "Extension" : "Coût"}</th>
                                    <th style={{ width: "25%", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cards.map((card, idx) => renderCardRow(card, idx, typeKey))}
                            </tbody>
                        </table>
                    </div>
                  );
              })}
            </div>
          )}

          {activeTab === 'stats' && (
             <div>
                <h3>Rapport de validation</h3>
                {validation && !validation.isValid ? (
                    <div className="dd-stats-error-box">
                        <ul className="dd-stats-error-list">
                            {validation.errors.map((error, i) => <li key={i}>{error}</li>)}
                        </ul>
                    </div>
                ) : (
                    <div className="dd-stats-success-box">
                        Le deck est valide pour le format {deck.format}.
                    </div>
                )}
                <DeckStats deck={deck} onUpdate={fetchDeck} />
             </div>
          )}

          {activeTab === 'settings' && <DeckSettings deck={deck} onUpdate={fetchDeck} />}
      </div>

      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-content dd-modal-img-content" onClick={(e) => e.stopPropagation()}>
             <h3 className="m-0">Choisir l'image du deck</h3>
             <div className="dd-modal-img-grid">
                 {deck.cards && deck.cards.map((card, i) => {
                     const displayImage = card.image_art_crop || card.image_normal;
                     if (!displayImage) return null;
                     return <img key={i} src={displayImage} alt={card.name} onClick={() => handleUpdateImage(displayImage)} className="dd-modal-img-item" />;
                 })}
             </div>
             <div className="mt-20" style={{ textAlign: "right" }}>
                <button className="btn-secondary" onClick={() => setShowImageModal(false)}>Annuler</button>
             </div>
          </div>
        </div>
      )}

      {selectedCard && !selectedCard.isMissing && (
        <CardModal 
          cardId={selectedCard.id} 
          deckContext={deckContext}
          onClose={() => { setSelectedCard(null); fetchDeck(); }} 
          onNext={handleNextCard}
          onPrev={handlePrevCard}
          hasNext={hasNextCard}
          hasPrev={hasPrevCard}
        />
      )}

      {selectedCard && selectedCard.isMissing && (
        <CardSearchDetailModal 
          cardId={selectedCard.id} 
          deckContext={deckContext}
          onClose={() => { setSelectedCard(null); fetchDeck(); }} 
          onNext={handleNextCard}
          onPrev={handlePrevCard}
          hasNext={hasNextCard}
          hasPrev={hasPrevCard}
        />
      )}
    </div>
  );
}