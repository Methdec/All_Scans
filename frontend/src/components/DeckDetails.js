import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { validateDeck } from "../utils/deckRules";
import CardModal from "./CardModal";
import "../theme.css";

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

  // --- LOGIQUE +/- QUANTITÉ ---
  const updateQuantity = async (e, cardId, action) => {
    // 🛑 Empêche l'ouverture de la modale quand on clique sur + ou -
    e.stopPropagation(); 

    try {
        const endpoint = action === "add" ? "add_card" : "remove_card";
        
        await fetch(`http://localhost:8000/items/${id}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ card_id: cardId })
        });
        
        // On rafraîchit le deck pour voir le changement
        fetchDeck();
    } catch (err) {
        console.error("Erreur update quantité", err);
    }
  };

  // --- LOGIQUE DE CATÉGORISATION ---
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

  const groupedCards = React.useMemo(() => {
    if (!deck || !deck.cards) return {};
    const groups = {};
    
    deck.cards.forEach(card => {
        const cat = getCardCategory(card.type_line);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(card);
    });

    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [deck]);

  const renderManaCost = (cost) => {
    if (!cost) return "";
    const parts = cost.match(/\{[^}]+\}/g) || [];
    return (
        <div className="mana-container">
            {parts.map((part, index) => {
                const symbol = part.replace(/[{}]/g, "");
                if (!isNaN(symbol) || symbol === "X") {
                    return <span key={index} className="mana-generic">{symbol}</span>;
                }
                const cleanSymbol = symbol.replace("/", "").toUpperCase();
                return (
                    <img key={index} src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`} alt={symbol} className="mana-icon" />
                );
            })}
        </div>
    );
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

  if (loading) return <div style={{padding: 20}}>Chargement...</div>;
  if (!deck) return null;

  return (
    <div style={{ padding: "20px", maxWidth: 1000, margin: "0 auto" }}>
      
      {/* En-tête (inchangé) */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30, alignItems: "flex-start" }}>
        <img 
            src={deck.image || "https://via.placeholder.com/150"} 
            alt="Cover" 
            style={{ width: 150, height: 200, objectFit: "cover", borderRadius: "var(--radius)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", cursor: "pointer" }}
            onClick={() => setShowImageModal(true)}
            title="Cliquez pour changer l'image"
        />
        <div style={{ flex: 1 }}>
            <button onClick={() => navigate("/items")} className="btn-secondary" style={{marginBottom: 10}}>← Retour</button>
            <h1 style={{ margin: "0 0 10px 0", fontSize: "2rem" }}>{deck.nom}</h1>
            <div style={{ display: "flex", gap: 15, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                <span>Format: <strong style={{color: "var(--primary)"}}>{deck.format}</strong></span>
                <span>Cartes: <strong>{deck.cards ? deck.cards.length : 0}</strong></span>
            </div>
            
            {validation && !validation.isValid && (
                <div style={{ marginTop: 20, padding: 15, background: "rgba(244, 67, 54, 0.1)", border: "1px solid var(--danger)", borderRadius: "var(--radius)", color: "#ff8080" }}>
                    <h4 style={{margin: "0 0 10px 0", display: "flex", alignItems: "center"}}>⚠️ Deck Invalide</h4>
                    {validation.errors && validation.errors.length > 0 ? (
                        <ul style={{margin: 0, paddingLeft: 20}}>
                            {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    ) : (
                        <p style={{margin:0}}>{validation.message}</p>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* LISTES PAR CATÉGORIE */}
      {TYPE_PRIORITY.map(typeKey => {
          const cards = groupedCards[typeKey];
          if (!cards || cards.length === 0) return null;

          return (
            <div key={typeKey} style={{ marginBottom: 30 }}>
                <h3 style={{ borderBottom: "2px solid var(--border)", paddingBottom: 5, marginBottom: 15, color: "var(--primary)", display: "flex", justifyContent: "space-between" }}>
                    {TYPE_TRANSLATIONS[typeKey]}
                    <span style={{fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal"}}>
                        {cards.length}
                    </span>
                </h3>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", tableLayout: "fixed" }}>
                    <thead>
                        <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                            {/* ✅ LARGEURS FIXES POUR ALIGNEMENT PARFAIT */}
                            <th style={{ padding: "8px", width: "40%" }}>Nom</th>
                            <th style={{ padding: "8px", width: "25%" }}>Type</th>
                            <th style={{ padding: "8px", width: "20%" }}>Coût</th>
                            <th style={{ padding: "8px", width: "15%", textAlign: "center" }}>Qté</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cards.map((card, idx) => (
                            <tr 
                                key={idx} 
                                onClick={() => setSelectedCardId(card.card_id)}
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "background 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                                <td style={{ padding: "8px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {card.name}
                                </td>
                                <td style={{ padding: "8px", color: "var(--text-muted)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {card.type_line}
                                </td>
                                <td style={{ padding: "8px" }}>
                                    {renderManaCost(card.mana_cost)}
                                </td>
                                <td style={{ padding: "8px", textAlign: "center" }}>
                                    {/* ✅ BOUTONS +/- AVEC STOP PROPAGATION */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                        <button 
                                            onClick={(e) => updateQuantity(e, card.card_id, "remove")}
                                            className="btn-secondary"
                                            style={{ padding: "0", width: "24px", height: "24px", lineHeight: "22px", borderRadius: "50%", fontSize: "14px" }}
                                            title="Retirer une carte"
                                        >
                                            -
                                        </button>
                                        
                                        <span style={{ fontWeight: "bold", color: "var(--primary)", minWidth: "20px" }}>
                                            {card.quantity}
                                        </span>
                                        
                                        <button 
                                            onClick={(e) => updateQuantity(e, card.card_id, "add")}
                                            className="btn-secondary"
                                            style={{ padding: "0", width: "24px", height: "24px", lineHeight: "22px", borderRadius: "50%", fontSize: "14px" }}
                                            title="Ajouter une carte"
                                        >
                                            +
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          );
      })}

      {/* MODALES (Image & Carte) */}
      {showImageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "80%", maxWidth: "800px", height: "80%", display: "flex", flexDirection: "column" }}>
             <h3 style={{marginTop:0}}>Choisir l'image du deck</h3>
             <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
                 {deck.cards && deck.cards.map((card, i) => (
                     card.image_normal && (
                         <img key={i} src={card.image_normal} alt={card.name} onClick={() => handleUpdateImage(card.image_normal)} style={{ width: "100%", borderRadius: "8px", cursor: "pointer" }} />
                     )
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