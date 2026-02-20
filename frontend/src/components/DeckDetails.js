import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { validateDeck } from "../utils/deckRules";
import CardModal from "./CardModal";
import DeckStats from "./DeckStats";
import DeckSettings from "./DeckSettings";
import "../theme.css";

// Image de dos de carte Magic officielle (Scryfall) - Beaucoup plus stable que via.placeholder.com
const DEFAULT_CARD_BACK = "https://cards.scryfall.io/large/back/0/0.jpg";

const TYPE_PRIORITY = [
  "Creature", "Planeswalker", "Instant", "Sorcery", 
  "Enchantment", "Artifact", "Battle", "Land", "Other"
];

const TYPE_TRANSLATIONS = {
  Creature: "Créatures", Planeswalker: "Planeswalkers", Instant: "Éphémères",
  Sorcery: "Rituels", Enchantment: "Enchantements", Artifact: "Artefacts",
  Battle: "Batailles", Land: "Terrains", Other: "Autres"
};

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");

  const fetchDeck = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:8000/items/${id}`, { credentials: "include" });
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

  const updateQuantity = async (e, cardId, action) => {
    e.stopPropagation(); 
    try {
        const endpoint = action === "add" ? "add_card" : "remove_card";
        await fetch(`http://localhost:8000/items/${id}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ card_id: cardId })
        });
        fetchDeck();
    } catch (err) {
        console.error("Erreur update quantité", err);
    }
  };

  const getCardCategory = (typeLine) => {
    if (!typeLine) return "Other";
    const ignored = ["legendary", "basic", "snow", "world", "tribal"];
    const types = typeLine.split("—")[0].trim().split(" ");
    
    for (let t of types) {
        if (!ignored.includes(t.toLowerCase())) {
            const cleanType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
            if (TYPE_TRANSLATIONS[cleanType]) return cleanType;
        }
    }
    return "Other";
  };

  const groupedCards = useMemo(() => {
    if (!deck || !deck.cards) return {};
    const groups = {};
    deck.cards.forEach(card => {
        const typeLine = card.type_line || "Other";
        const cat = getCardCategory(typeLine);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(card);
    });
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    });
    return groups;
  }, [deck]);

  // --- CALCUL DU TOTAL GLOBAL ---
  const totalCardsCount = useMemo(() => {
      if (!deck || !deck.cards) return 0;
      return deck.cards.reduce((acc, card) => acc + (card.quantity || 1), 0);
  }, [deck]);

  // --- AFFICHAGE MANA ---
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

  // --- LOGIQUE RETOUR CORRIGÉE ---
  const handleBack = () => {
      navigate(-1); // Revient simplement à la page précédente
  };


  const handleUpdateImage = async (imgUrl) => {
    try {
        await fetch(`http://localhost:8000/items/${deck.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ image: imgUrl })
        });
        setDeck({ ...deck, image: imgUrl });
        setShowImageModal(false);
    } catch (e) { console.error(e); }
  };

  // Styles onglets
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
      
      {/* HEADER */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        
        {/* IMAGE DU DECK (Avec fallback corrigé) */}
        <img 
            src={deck.image || DEFAULT_CARD_BACK} 
            alt="Cover" 
            style={{ width: 150, height: 200, objectFit: "cover", borderRadius: "var(--radius)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", cursor: "pointer" }}
            onClick={() => setShowImageModal(true)}
            onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_CARD_BACK; }} // Sécurité supplémentaire
        />

        <div style={{ flex: 1 }}>
            {/* BOUTON RETOUR */}
            <button onClick={handleBack} className="btn-secondary" style={{marginBottom: 10}}>← Retour</button>
            
            <h1 style={{ margin: "0 0 10px 0", fontSize: "2rem", display: "flex", alignItems: "center" }}>
                {/* Indicateur visuel si le deck est construit physiquement */}
                {deck.is_constructed && <span title="Deck Construit (Physique)" style={{fontSize:"1.5rem", marginRight:10}}>🏗️</span>}
                {deck.nom}
            </h1>
            
            <div style={{ display: "flex", gap: 15, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                <span>Format: <strong style={{color: "var(--primary)"}}>{deck.format}</strong></span>
                <span>Cartes: <strong>{totalCardsCount}</strong></span>
            </div>
            
            {validation && !validation.isValid && (
                <div style={{ marginTop: 20, padding: 10, background: "rgba(244, 67, 54, 0.1)", border: "1px solid var(--danger)", borderRadius: "var(--radius)", color: "#ff8080" }}>
                     <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                        <span style={{fontWeight:"bold"}}>⚠️ Deck Invalide</span>
                        <span>{validation.errors ? validation.errors.length : 1} erreur(s)</span>
                     </div>
                     {activeTab !== 'stats' && (
                        <small style={{display:"block", marginTop:5, cursor:"pointer", textDecoration:"underline"}} onClick={() => setActiveTab('stats')}>
                            Voir les détails dans Statistiques →
                        </small>
                     )}
                </div>
            )}
        </div>
      </div>

      {/* TABS */}
      <div style={tabContainerStyle}>
          <div style={getTabStyle(activeTab === 'cards')} onClick={() => setActiveTab('cards')}>Cartes</div>
          <div style={getTabStyle(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>Statistiques & Erreurs</div>
          <div style={getTabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>Paramètres</div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px 0" }}> 
          
          {/* ONGLET 1 : CARTES */}
          {activeTab === 'cards' && (
            <div>
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
                                    <th style={{ padding: "8px", width: "40%" }}>Nom</th>
                                    <th style={{ padding: "8px", width: "25%" }}>Type</th>
                                    <th style={{ padding: "8px", width: "20%" }}>{typeKey === "Land" ? "Extension" : "Coût"}</th>
                                    <th style={{ padding: "8px", width: "15%", textAlign: "center" }}>Qté</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cards.map((card, idx) => (
                                    <tr key={idx} onClick={() => setSelectedCardId(card.card_id)} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                                        <td style={{ padding: "8px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name || "Carte Fantôme"}</td>
                                        <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.type_line || "Inconnu"}</td>
                                        <td style={{ padding: "8px" }}>
                                            {typeKey === "Land" ? (
                                                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>{card.set_name || "N/A"}</span>
                                            ) : (
                                                renderManaCost(card.mana_cost)
                                            )}
                                        </td>
                                        <td style={{ padding: "8px", textAlign: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                                <button onClick={(e) => updateQuantity(e, card.card_id, "remove")} className="btn-secondary" style={{ padding: "0", width: "24px", height: "24px", borderRadius: "50%" }}>-</button>
                                                <span style={{ fontWeight: "bold", color: "var(--primary)", minWidth: "20px" }}>{card.quantity}</span>
                                                <button onClick={(e) => updateQuantity(e, card.card_id, "add")} className="btn-secondary" style={{ padding: "0", width: "24px", height: "24px", borderRadius: "50%" }}>+</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  );
              })}
            </div>
          )}

          {/* ONGLET 2 : STATS */}
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
                        ✅ Le deck est valide pour le format {deck.format}.
                    </div>
                )}
                <DeckStats deck={deck} onUpdate={fetchDeck} />
             </div>
          )}

          {/* ONGLET 3 : PARAMÈTRES */}
          {activeTab === 'settings' && (
              <DeckSettings deck={deck} onUpdate={fetchDeck} />
          )}
      </div>

      {showImageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "80%", maxWidth: "800px", height: "80%", display: "flex", flexDirection: "column" }}>
             <h3 style={{marginTop:0}}>Choisir l'image du deck</h3>
             <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
                 {deck.cards && deck.cards.map((card, i) => (
                     card.image_normal && <img key={i} src={card.image_normal} alt={card.name} onClick={() => handleUpdateImage(card.image_normal)} style={{ width: "100%", borderRadius: "8px", cursor: "pointer" }} />
                 ))}
             </div>
             <div style={{marginTop: 20, textAlign: "right"}}>
                <button className="btn-secondary" onClick={() => setShowImageModal(false)}>Annuler</button>
             </div>
          </div>
        </div>
      )}

      {selectedCardId && (
        <CardModal cardId={selectedCardId} onClose={() => { setSelectedCardId(null); fetchDeck(); }} />
      )}
    </div>
  );
}