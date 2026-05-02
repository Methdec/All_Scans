import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { validateDeck } from "../utils/deckRules";
import CardModal from "./CardModal";
import CardSearchDetailModal from "./CardSearchDetailModal";
import DeckStats from "./DeckStats";
import DeckSettings from "./DeckSettings";
import "../theme.css";

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
      const res = await fetch(`http://127.0.0.1:8000/items/${id}`, { credentials: "include" });
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
        await fetch(`http://127.0.0.1:8000/items/${id}/${endpoint}`, {
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
          await fetch(`http://127.0.0.1:8000/items/${id}/toggle_board`, {
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
          await fetch(`http://127.0.0.1:8000/items/${id}/toggle_commander`, {
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

  // CORRECTION : Tri stricte selon la priorite de TYPE_PRIORITY
  const getCardCategory = (typeLine) => {
    if (!typeLine) return "Other";
    const ignored = ["legendary", "basic", "snow", "world", "tribal"];
    // Separation avant le tiret (certains types Scryfall utilisent "—" ou "-")
    const mainTypeString = typeLine.split("—")[0].split("-")[0].trim();
    const types = mainTypeString.split(" ");
    
    let bestType = "Other";
    let bestPriorityIndex = 999; // Valeur haute par defaut

    for (let t of types) {
        if (ignored.includes(t.toLowerCase())) continue;
        const cleanType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        
        const priorityIdx = TYPE_PRIORITY.indexOf(cleanType);
        // Si le type existe dans notre liste et est prioritaire par rapport au precedent
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
        <div style={{ display: "flex", alignItems: "center", gap: "3px", flexWrap: "nowrap" }}>
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
        await fetch(`http://127.0.0.1:8000/items/${deck.id}`, {
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

    // CORRECTION : Verification si cette carte precise a declenche une erreur dans validateDeck
    const isInvalid = validation && validation.invalidCardIds && validation.invalidCardIds.includes(card.card_id);

    return (
        <tr 
            key={idx} 
            onClick={() => setSelectedCard({ id: card.card_id, isMissing, isSideboard: card.is_sideboard, deckQuantity: card.quantity })} 
            style={{ 
                borderBottom: "1px solid rgba(255,255,255,0.05)", 
                cursor: "pointer", 
                opacity: isMissing ? 0.8 : 1,
                backgroundColor: isInvalid ? "rgba(244, 67, 54, 0.1)" : "transparent",
                borderLeft: isInvalid ? "3px solid var(--danger, #F44336)" : "none"
            }}
        >
            <td style={{ padding: "8px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isMissing ? "var(--danger, #F44336)" : (isInvalid ? "var(--danger, #F44336)" : "inherit") }}>
                {card.name || "Carte Fantôme"}
                {isMissing && (
                    <span style={{ marginLeft: "8px", fontSize: "0.7rem", background: "var(--danger, #F44336)", color: "white", padding: "2px 6px", borderRadius: "4px" }}>
                        Manque x{missingQty}
                    </span>
                )}
                {isInvalid && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "8px", verticalAlign: "middle" }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                )}
            </td>
            <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {card.type_line || "Inconnu"}
            </td>
            <td style={{ padding: "8px" }}>
                {typeKey === "Land" ? <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>{card.set_name || "N/A"}</span> : renderManaCost(card.mana_cost)}
            </td>
            <td style={{ padding: "8px", textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                    
                    {isCommanderFormat && isLegendaryCreature && (
                        <button 
                            onClick={(e) => toggleCommander(e, card.card_id, card.is_commander)} 
                            className="btn-secondary" 
                            title={card.is_commander ? "Retirer du commandement" : "Désigner comme commandant"} 
                            style={{ 
                                padding: "0 5px", height: "24px", borderRadius: "4px", fontSize: "0.75rem", 
                                borderColor: card.is_commander ? "var(--primary)" : "var(--border)",
                                color: card.is_commander ? "var(--primary)" : "var(--text-muted)"
                            }}
                        >
                            Cmd
                        </button>
                    )}

                    <button onClick={(e) => updateQuantity(e, card.card_id, "remove", card.is_sideboard)} className="btn-secondary" style={{ padding: "0", width: "24px", height: "24px", borderRadius: "50%" }}>-</button>
                    <span style={{ fontWeight: "bold", color: "var(--primary)", minWidth: "20px", textAlign: "center" }}>{card.quantity}</span>
                    <button onClick={(e) => updateQuantity(e, card.card_id, "add", card.is_sideboard)} className="btn-secondary" style={{ padding: "0", width: "24px", height: "24px", borderRadius: "50%" }}>+</button>
                    
                    {canToggleBoard && (
                        <button onClick={(e) => toggleBoard(e, card.card_id, card.is_sideboard)} className="btn-secondary" title={card.is_sideboard ? "Déplacer vers le deck principal" : "Déplacer vers la réserve"} style={{ padding: "0", width: "24px", height: "24px", borderRadius: "4px", fontSize: "0.9rem", marginLeft: "5px" }}>
                            ⇌
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
  };

  const tabContainerStyle = { display: "flex", gap: "5px", marginTop: "30px", borderBottom: "2px solid var(--border)" };
  const getTabStyle = (isActive) => ({
      padding: "10px 20px", cursor: "pointer", borderTopLeftRadius: "8px", borderTopRightRadius: "8px",
      background: isActive ? "var(--bg-main)" : "var(--bg-input)", color: isActive ? "var(--primary)" : "var(--text-muted)",
      border: "1px solid var(--border)", borderBottom: isActive ? "1px solid var(--bg-main)" : "1px solid var(--border)", 
      marginBottom: "-2px", fontWeight: isActive ? "bold" : "normal", fontSize: "1rem"
  });

  if (loading) return <div style={{padding: 20}}>Chargement...</div>;
  if (!deck) return null;

  return (
    <div style={{ padding: "20px", maxWidth: 1000, margin: "0 auto" }}>
      
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <img 
            src={deck.image || DEFAULT_CARD_BACK} alt="Cover" 
            style={{ width: 150, height: 200, objectFit: "cover", borderRadius: "var(--radius)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", cursor: "pointer" }}
            onClick={() => setShowImageModal(true)}
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_CARD_BACK; }} 
        />
        <div style={{ flex: 1 }}>
            <button onClick={handleBack} className="btn-secondary" style={{marginBottom: 10}}>Retour</button>
            <h1 style={{ margin: "0 0 10px 0", fontSize: "2rem", display: "flex", alignItems: "center" }}>{deck.nom}</h1>
            <div style={{ display: "flex", gap: 15, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                <span>Format: <strong style={{color: "var(--primary)"}}>{deck.format}</strong></span>
                <span>Cartes: <strong style={{color: "var(--text-main)"}}>{mainboardCount}</strong> principal / <strong>{sideboardCount}</strong> réserve</span>
            </div>
            
            {validation && !validation.isValid && (
                <div style={{ marginTop: 20, padding: 10, background: "rgba(244, 67, 54, 0.1)", border: "1px solid var(--danger)", borderRadius: "var(--radius)", color: "#ff8080" }}>
                     <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                        <span style={{fontWeight:"bold"}}>Deck Invalide</span>
                        <span>{validation.errors ? validation.errors.length : 1} erreur(s)</span>
                     </div>
                     {activeTab !== 'stats' && (
                        <small style={{display:"block", marginTop:5, cursor:"pointer", textDecoration:"underline"}} onClick={() => setActiveTab('stats')}>
                            Voir les détails dans Statistiques
                        </small>
                     )}
                </div>
            )}
        </div>
      </div>

      <div style={tabContainerStyle}>
          <div style={getTabStyle(activeTab === 'cards')} onClick={() => setActiveTab('cards')}>Cartes</div>
          <div style={getTabStyle(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>Statistiques & Erreurs</div>
          <div style={getTabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>Paramètres</div>
      </div>

      <div style={{ padding: "20px 0" }}> 
          
          {activeTab === 'cards' && (
            <div>
              {deck.format === "commander" && groupedCards["Commander"] && (
                  <div style={{ marginBottom: 40, padding: 15, background: "rgba(255, 152, 0, 0.05)", border: "1px solid var(--primary)", borderRadius: "8px" }}>
                      <h3 style={{ borderBottom: "2px solid var(--primary)", paddingBottom: 5, margin: "0 0 15px 0", color: "var(--primary)", display: "flex", justifyContent: "space-between" }}>
                          Zone de Commandement
                          <span style={{fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal"}}>{groupedCards["Commander"].length}</span>
                      </h3>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", tableLayout: "fixed" }}>
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
                    <div key={typeKey} style={{ marginBottom: 30 }}>
                        <h3 style={{ borderBottom: "2px solid var(--border)", paddingBottom: 5, marginBottom: 15, color: "var(--primary)", display: "flex", justifyContent: "space-between" }}>
                            {TYPE_TRANSLATIONS[typeKey]}
                            <span style={{fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal"}}>{categoryCount}</span>
                        </h3>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", tableLayout: "fixed" }}>
                            <thead>
                                <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ padding: "8px", width: "35%" }}>Nom</th>
                                    <th style={{ padding: "8px", width: "25%" }}>Type</th>
                                    <th style={{ padding: "8px", width: "15%" }}>{typeKey === "Land" ? "Extension" : "Coût"}</th>
                                    <th style={{ padding: "8px", width: "25%", textAlign: "right" }}>Actions</th>
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
                <h3 style={{color: "var(--text-main)"}}>Rapport de validation</h3>
                {validation && !validation.isValid ? (
                    <div style={{ background: "var(--bg-input)", padding: "20px", borderRadius: "var(--radius)", border: "1px solid var(--border)", marginBottom: "40px" }}>
                        <ul style={{ color: "#ff8080", margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
                            {validation.errors.map((error, i) => <li key={i}>{error}</li>)}
                        </ul>
                    </div>
                ) : (
                    <div style={{ color: "var(--success)", padding: "20px", background: "rgba(76, 175, 80, 0.1)", borderRadius: "var(--radius)", marginBottom: "40px" }}>
                        Le deck est valide pour le format {deck.format}.
                    </div>
                )}
                <DeckStats deck={deck} onUpdate={fetchDeck} />
             </div>
          )}

          {activeTab === 'settings' && <DeckSettings deck={deck} onUpdate={fetchDeck} />}
      </div>

      {showImageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "80%", maxWidth: "800px", height: "80%", display: "flex", flexDirection: "column" }}>
             <h3 style={{marginTop:0}}>Choisir l'image du deck</h3>
             <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
                 {deck.cards && deck.cards.map((card, i) => {
                     const displayImage = card.image_art_crop || card.image_normal;
                     if (!displayImage) return null;
                     return <img key={i} src={displayImage} alt={card.name} onClick={() => handleUpdateImage(displayImage)} style={{ width: "100%", borderRadius: "8px", cursor: "pointer", objectFit: "cover", aspectRatio: "4/3" }} />;
                 })}
             </div>
             <div style={{marginTop: 20, textAlign: "right"}}>
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