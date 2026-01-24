import React, { useEffect, useState, useRef, useCallback } from "react";
import CardModal from "./CardModal"; 
import ImportModal from "./ImportModal"; 
import "../theme.css";

const MANA_SYMBOLS = {
  W: "https://svgs.scryfall.io/card-symbols/W.svg",
  U: "https://svgs.scryfall.io/card-symbols/U.svg",
  B: "https://svgs.scryfall.io/card-symbols/B.svg",
  R: "https://svgs.scryfall.io/card-symbols/R.svg",
  G: "https://svgs.scryfall.io/card-symbols/G.svg",
  C: "https://svgs.scryfall.io/card-symbols/C.svg"
};

const FORMATS = [
  { value: "", label: "Tous" },
  { value: "standard", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "commander", label: "Commander" },
  { value: "pioneer", label: "Pioneer" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
  { value: "pauper", label: "Pauper" },
];

export default function CardsList() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // ✅ Ref pour l'AbortController (Annulation des requêtes)
  const abortControllerRef = useRef(null);
  
  const observer = useRef();

  const [selectedCardId, setSelectedCardId] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // --- FILTRES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [typeFilters, setTypeFilters] = useState([]); 
  const [tempTypeInput, setTempTypeInput] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keywordsFilter, setKeywordsFilter] = useState("");
  const [cmcFilter, setCmcFilter] = useState("");
  const [powerFilter, setPowerFilter] = useState("");
  const [toughnessFilter, setToughnessFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");

  const lastCardElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prevPage => prevPage + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // ✅ FETCH OPTIMISÉ AVEC ABORT CONTROLLER
  const fetchCards = async (pageNumber, isNewFilter = false) => {
    // 1. Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }

    // 2. Créer un nouveau contrôleur
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("name", searchTerm);
      if (rarityFilter) params.append("rarity", rarityFilter);
      if (colorFilter) params.append("colors", colorFilter);

      if (typeFilters.length > 0) {
          const typeQuery = typeFilters.map(t => t.mode === "exclude" ? `-${t.text}` : t.text).join(",");
          params.append("type_line", typeQuery);
      }

      if (keywordsFilter) params.append("keywords", keywordsFilter);
      if (cmcFilter) params.append("cmc", cmcFilter);
      if (powerFilter) params.append("power", powerFilter);
      if (toughnessFilter) params.append("toughness", toughnessFilter);
      if (formatFilter) params.append("format_legality", formatFilter);

      params.append("page", pageNumber);
      params.append("limit", 60); 
      params.append("sort_by", "name"); 

      const endpoint = `http://localhost:8000/cards/search?${params.toString()}`;

      // 3. Passer le signal d'annulation au fetch
      const res = await fetch(endpoint, { 
          credentials: "include",
          signal: controller.signal 
      });

      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      
      setCards(prevCards => isNewFilter ? data.cards : [...prevCards, ...data.cards]);
      setHasMore(data.cards.length === 60);

    } catch (err) {
      // 4. Ignorer l'erreur si c'est juste une annulation
      if (err.name === 'AbortError') {
          console.log("Requête annulée (nouvelle recherche lancée)");
          return; 
      }
      console.error(err);
    } finally {
       // On enlève le loading seulement si ce n'est pas une requête annulée
       if (abortControllerRef.current === controller) {
           setLoading(false);
           abortControllerRef.current = null;
       }
    }
  };

  // Trigger filters
  useEffect(() => {
    // On vide immédiatement l'affichage pour donner un feedback visuel rapide
    setCards([]); 
    setPage(1);
    setHasMore(true);
    
    // Délai réduit à 300ms car l'annulation gère les conflits
    const delayDebounceFn = setTimeout(() => {
      fetchCards(1, true);
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line
  }, [searchTerm, rarityFilter, colorFilter, typeFilters, keywordsFilter, cmcFilter, powerFilter, toughnessFilter, formatFilter]);

  // Trigger Scroll
  useEffect(() => {
    if (page > 1) fetchCards(page, false);
    // eslint-disable-next-line
  }, [page]);

  const toggleColor = (colorCode) => {
    let currentColors = colorFilter ? colorFilter.split(",") : [];
    if (colorCode === "C") {
        if (currentColors.includes("C")) setColorFilter("");
        else setColorFilter("C");
        return;
    }
    if (currentColors.includes("C")) currentColors = [];
    if (currentColors.includes(colorCode)) currentColors = currentColors.filter(c => c !== colorCode);
    else currentColors.push(colorCode);
    setColorFilter(currentColors.join(","));
  };

  const handleTypeKeyDown = (e) => {
      if (e.key === "Enter" && tempTypeInput.trim() !== "") {
          e.preventDefault();
          setTypeFilters([...typeFilters, { text: tempTypeInput.trim(), mode: "include" }]);
          setTempTypeInput("");
      }
  };

  const removeTypeFilter = (index) => {
      const newFilters = [...typeFilters];
      newFilters.splice(index, 1);
      setTypeFilters(newFilters);
  };

  const toggleTypeMode = (index) => {
      const newFilters = [...typeFilters];
      newFilters[index].mode = newFilters[index].mode === "include" ? "exclude" : "include";
      setTypeFilters(newFilters);
  };

  const ManaSymbol = ({ code, alt }) => {
    const isSelected = colorFilter.split(",").includes(code);
    return (
      <img src={MANA_SYMBOLS[code]} alt={alt} onClick={() => toggleColor(code)}
        style={{ width: "35px", height: "35px", cursor: "pointer", borderRadius: "50%", border: isSelected ? "3px solid #FF9800" : "2px solid transparent", transform: isSelected ? "scale(1.2)" : "scale(1)", opacity: isSelected ? 1 : 0.7, transition: "all 0.2s", boxShadow: isSelected ? "0 0 15px rgba(255, 152, 0, 0.6)" : "none" }}
        onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.opacity = "1"; }} onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.opacity = "0.7"; }}
      />
    );
  };

  return (
    <div className="split-layout">
      
      <div className="sidebar-filters" style={{ overflowY: "auto" }}>
        <div className="sidebar-title">Ma Collection</div>

        <div className="filter-group">
          <label className="filter-label">Nom</label>
          <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="filter-group">
          <label className="filter-label">Couleurs</label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "10px", padding: "5px" }}>
            <ManaSymbol code="W" alt="Blanc" />
            <ManaSymbol code="U" alt="Bleu" />
            <ManaSymbol code="B" alt="Noir" />
            <ManaSymbol code="R" alt="Rouge" />
            <ManaSymbol code="G" alt="Vert" />
            <ManaSymbol code="C" alt="Incolore" />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Type(s)</label>
          <input 
            type="text" 
            placeholder="Ex: Creature (Entrée)" 
            value={tempTypeInput} 
            onChange={(e) => setTempTypeInput(e.target.value)}
            onKeyDown={handleTypeKeyDown}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
            {typeFilters.map((filter, index) => (
                <div key={index} style={{
                    display: "flex", alignItems: "center", fontSize: "0.8rem",
                    background: filter.mode === "include" ? "var(--bg-success-light, #1b3a24)" : "var(--bg-danger-light, #3a1b1b)",
                    border: `1px solid ${filter.mode === "include" ? "var(--success, #4CAF50)" : "var(--danger, #F44336)"}`,
                    borderRadius: "4px", padding: "2px 6px", color: "var(--text-main)"
                }}>
                    <span style={{ marginRight: "5px", fontWeight: "bold" }}>{filter.text}</span>
                    <button onClick={() => toggleTypeMode(index)} style={{ background: "transparent", border: "none", cursor: "pointer", color: filter.mode === "include" ? "#4CAF50" : "#F44336", marginRight: "5px", fontWeight: "bold", fontSize: "0.75rem" }} title="Changer mode">
                        {filter.mode === "include" ? "EST" : "NON"}
                    </button>
                    <button onClick={() => removeTypeFilter(index)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: "bold" }}>✕</button>
                </div>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Rareté</label>
          <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
            <option value="">Toutes</option>
            <option value="common">Commune</option>
            <option value="uncommon">Unco</option>
            <option value="rare">Rare</option>
            <option value="mythic">Mythique</option>
          </select>
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn-secondary" style={{ width: "100%", marginTop: "10px", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Paramètres avancés</span><span>{showAdvanced ? "▲" : "▼"}</span>
        </button>

        {showAdvanced && (
            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "var(--radius)", marginTop: "10px", border: "1px solid var(--border)" }}>
                <div className="filter-group">
                    <label className="filter-label">Mot(s) clé(s)</label>
                    <input type="text" placeholder="Ex: Flying, Haste..." value={keywordsFilter} onChange={(e) => setKeywordsFilter(e.target.value)} />
                </div>
                <div className="filter-group">
                    <label className="filter-label">Coût Mana (CMC)</label>
                    <input type="number" min="0" placeholder="Ex: 3" value={cmcFilter} onChange={(e) => setCmcFilter(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label className="filter-label">Force</label>
                        <input type="text" placeholder="" value={powerFilter} onChange={(e) => setPowerFilter(e.target.value)} />
                    </div>
                    <div className="filter-group" style={{ flex: 1 }}>
                        <label className="filter-label">Endu.</label>
                        <input type="text" placeholder="" value={toughnessFilter} onChange={(e) => setToughnessFilter(e.target.value)} />
                    </div>
                </div>
                <div className="filter-group">
                    <label className="filter-label">Légalité</label>
                    <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
                        {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                </div>
            </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
           <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px" }}>Cartes : <strong style={{ color: "var(--text-main)" }}>{cards.length}</strong></p>
           <button className="btn-import" onClick={() => setIsImportOpen(true)}>+ Importer</button>
        </div>
      </div>

      <div className="results-area">
        <div className="collection-grid">
            {cards.map((card, index) => (
                <div ref={cards.length === index + 1 ? lastCardElementRef : null} key={card._id || card.id} className="item-card" onClick={() => setSelectedCardId(card.id || card._id)} style={{ cursor: "pointer" }}>
                   <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {card.image_normal ? <img src={card.image_normal} alt={card.name} className="full-card-image" loading="lazy" /> : <div className="full-card-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', color: '#666' }}>No Image</div>}
                        <div className="card-info">
                            <div style={{ fontWeight: "bold", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>{card.set_name || "Edition inconnue"}</span>
                                <span style={{ color: "var(--primary)", fontWeight: "bold" }}>x{card.count || 1}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        {loading && <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>Chargement...</div>}
        {!loading && cards.length === 0 && <div style={{ textAlign: "center", marginTop: 50, color: "var(--text-muted)" }}>Aucune carte trouvée.</div>}
        {!loading && cards.length > 0 && !hasMore && <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "0.8rem" }}>— Fin de la collection —</div>}
      </div>

      {selectedCardId && <CardModal cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />}
      {isImportOpen && <ImportModal onClose={() => setIsImportOpen(false)} onImportComplete={() => { setIsImportOpen(false); setPage(1); fetchCards(1, true); }} />}
    </div>
  );
}