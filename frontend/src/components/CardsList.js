import React, { useEffect, useState, useRef, useCallback } from "react";
import CardModal from "./CardModal"; 
import ImportModal from "./ImportModal"; 
import CollectionManager from "./CollectionManager";
import TagsManager from "./TagsManager";
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
  { value: "", label: "Format (Tous)" },
  { value: "standard", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "commander", label: "Commander" },
  { value: "pioneer", label: "Pioneer" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
  { value: "pauper", label: "Pauper" },
];

export default function CardsList() {
  const [activeTab, setActiveTab] = useState("collection"); 
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const abortControllerRef = useRef(null);
  const observer = useRef();

  const [selectedCard, setSelectedCard] = useState(null); 
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [oracleText, setOracleText] = useState(""); 
  const [rarityFilter, setRarityFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [colorMode, setColorMode] = useState("exact");
  
  const [typeFilters, setTypeFilters] = useState([]); 
  const [tempTypeInput, setTempTypeInput] = useState("");
  
  const [tagFilters, setTagFilters] = useState([]);
  const [availableTags, setAvailableTags] = useState([]); 
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

  const [keywordsFilter, setKeywordsFilter] = useState("");
  const [cmcFilter, setCmcFilter] = useState("");
  const [powerFilter, setPowerFilter] = useState("");
  const [powerOp, setPowerOp] = useState("="); 
  const [toughnessFilter, setToughnessFilter] = useState("");
  const [toughnessOp, setToughnessOp] = useState("="); 
  const [formatFilter, setFormatFilter] = useState("");
  const [legalityStatus, setLegalityStatus] = useState("true"); 

  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState(-1);

  const [userSets, setUserSets] = useState([]);
  const [setFilter, setSetFilter] = useState(""); 

  const [tagsSummary, setTagsSummary] = useState([]);
  
  // NOUVEAU : État pour stocker le dictionnaire de couleurs
  const [tagColors, setTagColors] = useState({});

  const customStyles = `
    .custom-select {
      appearance: none; -webkit-appearance: none; -moz-appearance: none; background-color: var(--bg-input, #2a2a2a);
      color: var(--text-main, #fff); border: 1px solid var(--border, #444); padding: 8px 30px 8px 10px; border-radius: 4px;
      font-size: 0.9rem; width: 100%; cursor: pointer; box-sizing: border-box;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
      background-repeat: no-repeat; background-position: right 8px center; background-size: 20px; transition: all 0.2s ease;
    }
    .custom-select:hover { border-color: #FF9800; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FF9800'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e"); }
    .custom-input { width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border, #444); background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); font-size: 0.9rem; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .custom-input:hover, .custom-input:focus { border-color: #FF9800; }
    .select-prefix { border-radius: 4px 0 0 4px; border-right: none; width: 45px; padding: 8px 2px; text-align: center; background-position: right 0px center; background-size: 16px; padding-right: 12px; }
    .input-suffix { border-radius: 0 4px 4px 0; }
    .tab-button { background: transparent; border: none; color: var(--text-main); font-weight: bold; font-size: 1.1rem; cursor: pointer; padding: 10px 20px; border-bottom: 3px solid transparent; transition: all 0.2s; }
    .tab-button.active { color: var(--primary, #FF9800); border-bottom: 3px solid var(--primary, #FF9800); }
    .tab-button:hover:not(.active) { color: var(--primary, #FF9800); opacity: 0.8; }
  `;

  const fieldContainerStyle = { marginBottom: "15px" };
  const labelStyle = { display: "block", marginBottom: "5px", fontSize: "0.85rem", color: "var(--text-muted, #aaa)", fontWeight: "600" };

  const fetchAvailableTags = async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/me/collection/tags", { credentials: "include" });
          if (res.ok) {
              const data = await res.json();
              setAvailableTags(data.tags || []);
          }
      } catch (err) {
          console.error("Erreur de chargement des tags :", err);
      }
  };

  // NOUVEAU : Fonction pour récupérer les couleurs des tags
  const fetchTagRulesColors = async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/tags/rules", { credentials: "include" });
          if (res.ok) {
              const data = await res.json();
              const colorMap = {};
              data.rules.forEach(r => {
                  if (r.color) colorMap[r.tag_name.toLowerCase()] = r.color;
              });
              setTagColors(colorMap);
          }
      } catch (err) { console.error("Erreur de chargement des couleurs de tags :", err); }
  };

  useEffect(() => {
      if (activeTab === "collection") {
          fetchAvailableTags();
          fetchTagRulesColors(); // NOUVEAU
      }
  }, [activeTab]);

  useEffect(() => {
      if (activeTab !== "collection" || sortBy !== "set") return;
      const loadSets = async () => {
          setLoading(true);
          try {
              const res = await fetch(`http://127.0.0.1:8000/cards/collection/sets?sort_dir=${sortDir}`, { credentials: "include" });
              if (res.ok) {
                  const data = await res.json();
                  setUserSets(data.sets || []);
              }
          } catch (e) { console.error(e); } finally { setLoading(false); }
      };
      loadSets();
  }, [activeTab, sortBy, sortDir]);

  useEffect(() => {
      if (activeTab !== "collection" || sortBy !== "tags") return;
      const loadTagsSummary = async () => {
          setLoading(true);
          try {
              const res = await fetch(`http://127.0.0.1:8000/cards/collection/tags_summary?sort_dir=${sortDir}`, { credentials: "include" });
              if (res.ok) {
                  const data = await res.json();
                  setTagsSummary(data.tags_summary || []);
              }
          } catch (e) { console.error(e); } finally { setLoading(false); }
      };
      loadTagsSummary();
  }, [activeTab, sortBy, sortDir]);

  const lastCardElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(prevPage => prevPage + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchCards = async (pageNumber, isNewFilter = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("name", searchTerm);
      if (oracleText) params.append("oracle_text", oracleText);
      if (rarityFilter) params.append("rarity", rarityFilter);
      
      if (colorFilter) {
          params.append("colors", colorFilter);
          params.append("color_mode", colorMode);
      }

      if (typeFilters.length > 0) {
          const typeQuery = typeFilters.map(t => t.mode === "exclude" ? `-${t.text}` : t.text).join(",");
          params.append("type_line", typeQuery);
      }

      if (tagFilters.length > 0) {
          const tagQuery = tagFilters.map(t => t.mode === "exclude" ? `-${t.text}` : t.text).join(",");
          params.append("tags", tagQuery);
      }

      if (keywordsFilter) params.append("keywords", keywordsFilter);
      if (cmcFilter) params.append("cmc", cmcFilter);
      
      if (powerFilter) {
        params.append("power", powerFilter);
        params.append("power_op", powerOp);
      }
      if (toughnessFilter) {
        params.append("toughness", toughnessFilter);
        params.append("toughness_op", toughnessOp);
      }
      
      if (formatFilter) {
          params.append("format_legality", formatFilter);
          if (legalityStatus) params.append("is_legal", legalityStatus);
      }

      if (setFilter) params.append("set_code", setFilter);

      params.append("page", pageNumber);
      params.append("limit", 60); 
      params.append("sort_by", sortBy); 
      params.append("sort_dir", sortDir);

      const endpoint = `http://127.0.0.1:8000/cards/search?${params.toString()}`;

      const res = await fetch(endpoint, { 
          credentials: "include",
          signal: controller.signal 
      });

      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      
      setCards(prevCards => isNewFilter ? data.cards : [...prevCards, ...data.cards]);
      setHasMore(data.cards.length === 60);

    } catch (err) {
      if (err.name === 'AbortError') return; 
      console.error(err);
    } finally {
       if (abortControllerRef.current === controller) {
           setLoading(false);
           abortControllerRef.current = null;
       }
    }
  };

  useEffect(() => {
    if (activeTab !== "collection") return;
    if (sortBy === "set" || sortBy === "tags") return; 
    
    setCards([]); 
    setPage(1);
    setHasMore(true);
    const delayDebounceFn = setTimeout(() => { fetchCards(1, true); }, 300);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line
  }, [searchTerm, oracleText, rarityFilter, colorFilter, colorMode, typeFilters, tagFilters, keywordsFilter, cmcFilter, powerFilter, powerOp, toughnessFilter, toughnessOp, formatFilter, legalityStatus, sortBy, sortDir, setFilter, activeTab]);

  useEffect(() => {
    if (page > 1 && activeTab === "collection" && sortBy !== "set" && sortBy !== "tags") fetchCards(page, false);
    // eslint-disable-next-line
  }, [page, activeTab, sortBy]);

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

  const handleTagSelect = (e) => {
      const selectedTag = e.target.value;
      if (selectedTag && !tagFilters.find(t => t.text === selectedTag)) {
          setTagFilters([...tagFilters, { text: selectedTag, mode: "include" }]);
      }
      e.target.value = ""; 
  };

  const removeTagFilter = (index) => {
      const newFilters = [...tagFilters];
      newFilters.splice(index, 1);
      setTagFilters(newFilters);
  };

  const toggleTagMode = (index) => {
      const newFilters = [...tagFilters];
      newFilters[index].mode = newFilters[index].mode === "include" ? "exclude" : "include";
      setTagFilters(newFilters);
  };

  const ManaSymbol = ({ code, alt }) => {
    const isSelected = colorFilter.split(",").includes(code);
    return (
      <img src={MANA_SYMBOLS[code]} alt={alt} onClick={() => toggleColor(code)}
        style={{ width: "32px", height: "32px", cursor: "pointer", borderRadius: "50%", border: isSelected ? "3px solid #FF9800" : "2px solid transparent", transform: isSelected ? "scale(1.1)" : "scale(1)", opacity: isSelected ? 1 : 0.6, transition: "all 0.2s" }}
      />
    );
  };

  const selectedIndex = cards.findIndex(c => 
      (c.id || c._id) === (selectedCard?.id || selectedCard?._id) && 
      c.is_foil === selectedCard?.is_foil
  );
  
  const hasPrevCard = selectedIndex > 0;
  const hasNextCard = selectedIndex !== -1 && selectedIndex < cards.length - 1;

  const handlePrevCard = () => {
    if (hasPrevCard) {
        const prevCard = cards[selectedIndex - 1];
        setSelectedCard({ id: prevCard.id || prevCard._id, is_foil: prevCard.is_foil });
    }
  };

  const handleNextCard = () => {
    if (hasNextCard) {
        const nextCard = cards[selectedIndex + 1];
        setSelectedCard({ id: nextCard.id || nextCard._id, is_foil: nextCard.is_foil });
    }
  };

  const handleCloseModal = (hasChanged) => {
    setSelectedCard(null);
    if (hasChanged === true) {
        fetchAvailableTags();
        fetchTagRulesColors(); // NOUVEAU
        fetchCards(page, true); 
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      <style>{customStyles}</style>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-main)" }}>
        <button className={`tab-button ${activeTab === "collection" ? "active" : ""}`} onClick={() => setActiveTab("collection")}>Ma Collection</button>
        <button className={`tab-button ${activeTab === "sync" ? "active" : ""}`} onClick={() => setActiveTab("sync")}>Import / Export</button>
      </div>

      {activeTab === "collection" && (
        <div className="split-layout" style={{ flex: 1, overflow: "hidden" }}>
          
          <div className="sidebar-filters" style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden", borderRight: "1px solid var(--border)" }}>
            
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px" }}>
                <div className="sidebar-title" style={{ marginBottom: "20px" }}>Filtres de Collection</div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Nom</label>
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="custom-input" />
                </div>

                <div style={fieldContainerStyle}>
                    <div style={{display: "flex", alignItems: "center", marginBottom: "5px", justifyContent: "space-between"}}>
                        <label style={{...labelStyle, marginBottom: 0}}>Couleurs</label>
                        <select 
                            value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="custom-select"
                            style={{ width: "auto", padding: "2px 25px 2px 8px", fontSize: "0.75rem", height: "auto" }}
                            title="Exacte = Strictement ces couleurs. Approx = Inclus dans ces couleurs."
                        >
                            <option value="exact">Exacte</option>
                            <option value="subset">Approx.</option>
                        </select>
                    </div>
                    
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", background: "var(--bg-input, rgba(0,0,0,0.2))", padding: "10px", borderRadius: "4px" }}>
                        {Object.keys(MANA_SYMBOLS).map(c => <ManaSymbol key={c} code={c} alt={c} />)}
                    </div>
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Type(s)</label>
                    <input type="text" placeholder="Ex: Creature (Entrée)" value={tempTypeInput} onChange={(e) => setTempTypeInput(e.target.value)} onKeyDown={handleTypeKeyDown} className="custom-input" />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                        {typeFilters.map((filter, index) => (
                            <div key={index} style={{
                                display: "flex", alignItems: "center", fontSize: "0.75rem",
                                background: filter.mode === "include" ? "var(--bg-success-light, #1b3a24)" : "var(--bg-danger-light, #3a1b1b)",
                                border: `1px solid ${filter.mode === "include" ? "var(--success, #4CAF50)" : "var(--danger, #F44336)"}`,
                                borderRadius: "4px", padding: "2px 6px", color: "var(--text-main)", maxWidth: "100%", overflow: "hidden"
                            }}>
                                <span style={{ marginRight: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{filter.text}</span>
                                <button 
                                    onClick={() => toggleTypeMode(index)} 
                                    style={{ background: "transparent", border: "none", cursor: "pointer", color: filter.mode === "include" ? "#4CAF50" : "#F44336", marginRight: "5px", fontWeight: "bold", fontSize: "0.75rem" }}
                                    title="Basculer entre Inclus (EST) et Exclus (NON)"
                                >
                                    {filter.mode === "include" ? "EST" : "NON"}
                                </button>
                                <button onClick={() => removeTypeFilter(index)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: "bold" }}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Texte</label>
                    <input type="text" placeholder="Ex: draw a card" value={oracleText} onChange={(e) => setOracleText(e.target.value)} className="custom-input" />
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Rareté</label>
                    <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} className="custom-select">
                        <option value="">Toutes</option>
                        <option value="common">Commune</option>
                        <option value="uncommon">Unco</option>
                        <option value="rare">Rare</option>
                        <option value="mythic">Mythique</option>
                    </select>
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Mot(s) clé(s)</label>
                    <input type="text" placeholder="Ex: Flying, Haste..." value={keywordsFilter} onChange={(e) => setKeywordsFilter(e.target.value)} className="custom-input" />
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Coût Mana (CMC)</label>
                    <input type="number" min="0" placeholder="Ex: 3" value={cmcFilter} onChange={(e) => setCmcFilter(e.target.value)} className="custom-input" />
                </div>

                <div style={fieldContainerStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                        <label style={{...labelStyle, marginBottom: 0}}>Tag(s) actif(s)</label>
                        <button 
                            onClick={() => setIsTagsModalOpen(true)} 
                            style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", textDecoration: "underline", padding: 0 }}
                        >
                            (Gérer les règles)
                        </button>
                    </div>
                    
                    <select onChange={handleTagSelect} value="" className="custom-select">
                        <option value="" disabled>Sélectionner un tag...</option>
                        {availableTags.length === 0 && <option value="" disabled>Aucun tag trouvé</option>}
                        {availableTags.filter(t => t.trim() !== "").map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>
                    
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                        {tagFilters.map((filter, index) => {
                            const customColor = tagColors[filter.text.toLowerCase()] || (filter.mode === "include" ? "#4CAF50" : "#F44336");
                            return (
                                <div key={index} style={{
                                    display: "flex", alignItems: "center", fontSize: "0.75rem",
                                    background: filter.mode === "include" ? "var(--bg-success-light, #1b3a24)" : "var(--bg-danger-light, #3a1b1b)",
                                    border: `1px solid ${customColor}`,
                                    borderRadius: "4px", padding: "2px 6px", color: "var(--text-main)", maxWidth: "100%", overflow: "hidden"
                                }}>
                                    <span style={{ marginRight: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: customColor }}>
                                        {filter.text.toUpperCase()}
                                    </span>
                                    <button 
                                        onClick={() => toggleTagMode(index)} 
                                        style={{ background: "transparent", border: "none", cursor: "pointer", color: filter.mode === "include" ? "#4CAF50" : "#F44336", marginRight: "5px", fontWeight: "bold", fontSize: "0.75rem" }}
                                        title="Basculer entre Inclus (EST) et Exclus (NON)"
                                    >
                                        {filter.mode === "include" ? "EST" : "NON"}
                                    </button>
                                    <button onClick={() => removeTagFilter(index)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontWeight: "bold" }}>✕</button>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div style={fieldContainerStyle}>
                    <label style={labelStyle}>Légalité</label>
                    <div style={{display: "flex", gap: "8px"}}>
                        <div style={{flex: 2}}>
                            <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className="custom-select">
                                {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                        <div style={{flex: 1.2}}>
                            <select value={legalityStatus} onChange={(e) => setLegalityStatus(e.target.value)} className="custom-select">
                                <option value="true">Légal</option>
                                <option value="false">Ban</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Force</label>
                        <div style={{display: "flex"}}>
                            <select value={powerOp} onChange={(e) => setPowerOp(e.target.value)} className="custom-select select-prefix">
                                <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option>
                            </select>
                            <input type="text" value={powerFilter} onChange={(e) => setPowerFilter(e.target.value)} className="custom-input input-suffix" />
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Endu.</label>
                        <div style={{display: "flex"}}>
                            <select value={toughnessOp} onChange={(e) => setToughnessOp(e.target.value)} className="custom-select select-prefix">
                                <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option>
                            </select>
                            <input type="text" value={toughnessFilter} onChange={(e) => setToughnessFilter(e.target.value)} className="custom-input input-suffix" />
                        </div>
                    </div>
                </div>

                <div style={{...fieldContainerStyle, marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "15px"}}>
                    <label style={labelStyle}>Trier par</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="custom-select" style={{ flex: 1 }}>
                            <option value="name">Nom</option>
                            <option value="count">Quantité possédée</option>
                            <option value="price">Prix estimé</option>
                            <option value="set">Extension (Grille)</option>
                            <option value="tags">Tags (Grille)</option>
                        </select>
                        <button 
                            onClick={() => setSortDir(sortDir === 1 ? -1 : 1)} 
                            className="btn-secondary" 
                            style={{ padding: "0 12px", fontSize: "1.1rem", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title={sortDir === 1 ? "Croissant (Vieux -> Récent / A-Z)" : "Décroissant (Récent -> Vieux / Z-A)"}
                        >
                            {sortDir === 1 ? "v" : "^"}
                        </button>
                    </div>
                </div>
                
                <div style={{ height: "10px" }}></div>
            </div>

            <div style={{ marginTop: "auto", padding: "10px 15px 15px 15px", flexShrink: 0, backgroundColor: "var(--bg-sidebar, inherit)", borderTop: "1px solid var(--border)" }}>
               <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0", textAlign: "center" }}>Cartes affichées : <strong style={{ color: "var(--text-main)" }}>{cards.length}</strong></p>
            </div>
          </div>

          <div className="results-area" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-main)" }}>
            
            {setFilter && sortBy !== "set" && sortBy !== "tags" && (
                <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", alignItems: "center", background: "var(--bg-sidebar)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", background: "rgba(255, 152, 0, 0.15)", border: "1px solid var(--primary)", padding: "5px 15px", borderRadius: "20px", color: "var(--text-main)", fontWeight: "bold", fontSize: "0.9rem" }}>
                        Extension filtrée : <span style={{ color: "var(--primary)", marginLeft: "5px" }}>{setFilter.toUpperCase()}</span>
                        <button onClick={() => setSetFilter("")} style={{ background: "transparent", border: "none", marginLeft: "10px", cursor: "pointer", fontWeight: "bold", color: "var(--danger)", fontSize: "1rem" }} title="Retirer ce filtre">✕</button>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                {sortBy === "set" ? (
                    <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                        {loading ? (
                            <div style={{ textAlign: "center", width: "100%", padding: "20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Chargement des extensions...</div>
                        ) : userSets.length === 0 ? (
                            <div style={{ textAlign: "center", width: "100%", padding: "20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Aucune extension trouvée.</div>
                        ) : (
                            (() => {
                                let currentYear = null;
                                return userSets.map((set) => {
                                    const setYear = set.released_at ? set.released_at.substring(0, 4) : "Inconnu";
                                    const showYearHeader = setYear !== currentYear;
                                    currentYear = setYear;

                                    return (
                                        <React.Fragment key={set.set_code}>
                                            {showYearHeader && (
                                                <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid var(--border)", paddingBottom: "5px", marginTop: "15px", color: "var(--primary)", fontSize: "1.2rem", fontWeight: "bold" }}>
                                                    {setYear}
                                                </div>
                                            )}
                                            <div 
                                                onClick={() => { 
                                                    setSetFilter(set.set_code); 
                                                    setSortBy("name"); 
                                                }} 
                                                style={{ background: "var(--bg-input)", borderRadius: "12px", padding: "15px 20px", display: "flex", alignItems: "center", gap: "20px", cursor: "pointer", transition: "transform 0.2s, border-color 0.2s", border: "2px solid transparent", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }} 
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-3px)"; }} 
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
                                            >
                                                <img src={`https://svgs.scryfall.io/sets/${set.set_code}.svg`} alt={set.set_name} style={{ width: "40px", height: "40px", filter: "brightness(0) invert(1)" }} onError={(e) => e.target.style.display = 'none'} />
                                                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                                                    <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={set.set_name}>{set.set_name}</span>
                                                    <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "4px" }}>{set.count} carte{set.count > 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()
                        )}
                    </div>
                ) : sortBy === "tags" ? (
                    <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
                        {loading ? (
                            <div style={{ textAlign: "center", width: "100%", padding: "20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Chargement des tags...</div>
                        ) : tagsSummary.length === 0 ? (
                            <div style={{ textAlign: "center", width: "100%", padding: "20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Aucun tag trouvé.</div>
                        ) : (
                            tagsSummary.map(tagObj => {
                                const currentTagColor = tagColors[tagObj.tag_name.toLowerCase()] || "var(--primary)";
                                return (
                                    <div key={tagObj.tag_name}
                                         onClick={() => {
                                             if (tagObj.tag_name !== "Sans tag") {
                                                 if (!tagFilters.find(t => t.text === tagObj.tag_name)) {
                                                     setTagFilters([...tagFilters, { text: tagObj.tag_name, mode: "include" }]);
                                                 }
                                             }
                                             setSortBy("name");
                                         }}
                                         style={{
                                            background: "var(--bg-input)", borderRadius: "12px", padding: "25px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.2s, border-color 0.2s", border: "2px solid transparent", boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                                         }}
                                         onMouseEnter={e => { e.currentTarget.style.borderColor = currentTagColor; e.currentTarget.style.transform = "translateY(-3px)"; }}
                                         onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
                                    >
                                        <h3 style={{ margin: "0 0 10px 0", color: currentTagColor, textTransform: "uppercase", fontSize: "1.2rem", textAlign: "center", wordBreak: "break-word" }}>
                                            {tagObj.tag_name}
                                        </h3>
                                        <div style={{ color: "var(--text-muted)", fontSize: "1rem", fontWeight: "bold" }}>
                                            {tagObj.count} carte{tagObj.count > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="collection-grid" style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
                        {cards.map((card, index) => (
                            <div 
                              ref={cards.length === index + 1 ? lastCardElementRef : null} 
                              key={card._id || `${card.id}_${card.is_foil}`} 
                              className="item-card" 
                              onClick={() => setSelectedCard({ id: card.id || card._id, is_foil: card.is_foil })} 
                              style={{ 
                                backgroundColor: "var(--bg-input, #1e1e1e)", borderRadius: "10px", padding: "12px", 
                                cursor: "pointer", display: "flex", flexDirection: "column", border: "2px solid transparent", 
                                transition: "border-color 0.2s, transform 0.2s", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" 
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary, #FF9800)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
                            >
                               <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
                                      {card.image_normal ? (
                                        <img src={card.image_normal} alt={card.name} style={{ width: "100%", height: "auto", borderRadius: "4.75% / 3.5%", display: "block" }} loading="lazy" />
                                      ) : (
                                        <div style={{ width: "100%", aspectRatio: "2.5/3.5", backgroundColor: "#333", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Pas d'image</div>
                                      )}
                                    </div>
                                    
                                    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
                                        <div style={{ fontWeight: "bold", color: "var(--text-main, #fff)", fontSize: "0.95rem", textAlign: "center", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={card.name}>
                                          {card.name}
                                          {card.is_foil && (
                                             <span style={{ marginLeft: "6px", background: "linear-gradient(45deg, #FFD700, #FF9800)", color: "#121212", fontSize: "0.65rem", fontWeight: "bold", padding: "2px 4px", borderRadius: "4px", verticalAlign: "middle" }}>
                                                 F
                                             </span>
                                          )}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ color: "var(--text-muted, #aaa)", fontSize: "0.8rem", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} title={card.set_name}>
                                                {sortBy === "price" ? (
                                                    card.prices?.eur ? <span style={{ color: "#4CAF50", fontWeight: "bold" }}>{card.prices.eur} €</span> : "N/A"
                                                ) : (
                                                    card.set_name || "?"
                                                )}
                                            </span>
                                            <span style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "0.9rem" }}>x{card.count || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>Chargement...</div>}
                        {!loading && cards.length === 0 && <div style={{ textAlign: "center", marginTop: 50, color: "var(--text-muted)", gridColumn: "1 / -1" }}>Aucune carte trouvée.</div>}
                    </div>
                )}
            </div>
          </div>

          {selectedCard && (
            <CardModal 
              cardId={selectedCard.id} 
              isFoil={selectedCard.is_foil}
              defaultCount={cards[selectedIndex]?.count || 1}
              tagColors={tagColors} // NOUVEAU
              onClose={handleCloseModal} 
              onNext={handleNextCard}
              onPrev={handlePrevCard}
              hasNext={hasNextCard}
              hasPrev={hasPrevCard}
            />
          )}
          {isImportOpen && <ImportModal onClose={() => setIsImportOpen(false)} onImportComplete={() => { setIsImportOpen(false); setPage(1); fetchCards(1, true); }} />}
        </div>
      )}

      {activeTab === "sync" && (
          <CollectionManager />
      )}

      {isTagsModalOpen && (
          <TagsManager onClose={() => { setIsTagsModalOpen(false); fetchTagRulesColors(); }} />
      )}
    </div>
  );
}