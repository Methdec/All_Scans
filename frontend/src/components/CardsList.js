import React, { useEffect, useState, useRef, useCallback } from "react";
import CardModal from "./CardModal";
import CollectionManager from "./CollectionManager";
import TagsManager from "./TagsManager";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

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
  const [tagColors, setTagColors] = useState({});

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const fetchAvailableTags = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/me/collection/tags`, { credentials: "include" });
          if (res.ok) {
              const data = await res.json();
              setAvailableTags(data.tags || []);
          }
      } catch (err) {
          console.error("Erreur de chargement des tags :", err);
      }
  };

  const fetchTagRulesColors = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/tags/rules`, { credentials: "include" });
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
          fetchTagRulesColors(); 
      }
  }, [activeTab]);

  useEffect(() => {
      if (activeTab !== "collection" || sortBy !== "set") return;
      const loadSets = async () => {
          setLoading(true);
          try {
              const res = await fetch(`${API_BASE_URL}/cards/collection/sets?sort_dir=${sortDir}`, { credentials: "include" });
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
              const res = await fetch(`${API_BASE_URL}/cards/collection/tags_summary?sort_dir=${sortDir}`, { credentials: "include" });
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

      const endpoint = `${API_BASE_URL}/cards/search?${params.toString()}`;

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

  // Fonction pure pour afficher le symbole, évite les re-rendus intempestifs
  const renderManaSymbol = (code) => {
    const isSelected = colorFilter.split(",").includes(code);
    return (
      <img 
        key={code}
        src={MANA_SYMBOLS[code]} 
        alt={code} 
        onClick={() => toggleColor(code)}
        className={`mana-symbol-filter ${isSelected ? 'selected' : ''}`}
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
        fetchTagRulesColors(); 
        fetchCards(page, true); 
    }
  };

  return (
    <div className="cl-page-container">

      {/* Onglets */}
      <div className="cl-tabs-wrapper">
        <button className={`tab-button ${activeTab === "collection" ? "active" : ""}`} onClick={() => setActiveTab("collection")}>Ma Collection</button>
        <button className={`tab-button ${activeTab === "sync" ? "active" : ""}`} onClick={() => setActiveTab("sync")}>Import / Export</button>
      </div>

      {activeTab === "collection" && (
        <div className="cl-main-layout">
          
          {/* --- RECHERCHE MOBILE --- */}
          <div className="mobile-search-header">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setShowMobileFilters(false)}
              placeholder="Rechercher dans la collection..."
              className="mobile-main-search-input"
            />
            <button
              type="button"
              className="mobile-filter-toggle"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              Filtres {showMobileFilters ? "▲" : "▼"}
            </button>
          </div>

          {/* Structure Flex Robuste pour éviter l'effondrement sur mobile */}
          <div style={{ display: "flex", flex: 1, position: "relative", width: "100%", overflow: "hidden" }}>
            
            {/* BARRE DE FILTRES GAUCHE */}
            <div className={`cl-sidebar ${showMobileFilters ? "mobile-expanded" : ""}`}>
              
              <div className="cl-sidebar-content">
                  <div className="sidebar-title" style={{ marginBottom: "20px" }}>Filtres de Collection</div>

                  <div className="cl-field-container desktop-only-search">
                      <label className="cl-label">Nom</label>
                      <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="custom-input" />
                  </div>

                  <div className="cl-field-container">
                      <div className="cl-filter-header">
                          <label className="cl-label" style={{ marginBottom: 0 }}>Couleurs</label>
                          <select 
                              value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="custom-select"
                              style={{ width: "auto", padding: "2px 25px 2px 8px", fontSize: "0.75rem", height: "auto" }}
                              title="Exacte = Strictement ces couleurs. Approx = Inclus dans ces couleurs."
                          >
                              <option value="exact">Exacte</option>
                              <option value="subset">Approx.</option>
                          </select>
                      </div>
                      
                      <div className="cl-mana-container">
                          {Object.keys(MANA_SYMBOLS).map(c => renderManaSymbol(c))}
                      </div>
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Type(s)</label>
                      <input type="text" placeholder="Ex: Creature (Entrée)" value={tempTypeInput} onChange={(e) => setTempTypeInput(e.target.value)} onKeyDown={handleTypeKeyDown} className="custom-input" />
                      <div className="cl-active-filters">
                          {typeFilters.map((filter, index) => (
                              <div key={index} className="cl-filter-badge" style={{
                                  background: filter.mode === "include" ? "var(--bg-success-light, #1b3a24)" : "var(--bg-danger-light, #3a1b1b)",
                                  borderColor: filter.mode === "include" ? "var(--success, #4CAF50)" : "var(--danger, #F44336)"
                              }}>
                                  <span className="cl-filter-badge-text">{filter.text}</span>
                                  <button 
                                      onClick={() => toggleTypeMode(index)} 
                                      className="cl-filter-badge-btn"
                                      style={{ color: filter.mode === "include" ? "#4CAF50" : "#F44336" }}
                                      title="Basculer entre Inclus (EST) et Exclus (NON)"
                                  >
                                      {filter.mode === "include" ? "EST" : "NON"}
                                  </button>
                                  <button onClick={() => removeTypeFilter(index)} className="cl-filter-badge-close">✕</button>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Texte</label>
                      <input type="text" placeholder="Ex: draw a card" value={oracleText} onChange={(e) => setOracleText(e.target.value)} className="custom-input" />
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Rareté</label>
                      <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} className="custom-select">
                          <option value="">Toutes</option>
                          <option value="common">Commune</option>
                          <option value="uncommon">Unco</option>
                          <option value="rare">Rare</option>
                          <option value="mythic">Mythique</option>
                      </select>
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Mot(s) clé(s)</label>
                      <input type="text" placeholder="Ex: Flying, Haste..." value={keywordsFilter} onChange={(e) => setKeywordsFilter(e.target.value)} className="custom-input" />
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Coût Mana (CMC)</label>
                      <input type="number" min="0" placeholder="Ex: 3" value={cmcFilter} onChange={(e) => setCmcFilter(e.target.value)} className="custom-input" />
                  </div>

                  <div className="cl-field-container">
                      <div className="cl-filter-header">
                          <label className="cl-label" style={{ marginBottom: 0 }}>Tag(s) actif(s)</label>
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
                      
                      <div className="cl-active-filters">
                          {tagFilters.map((filter, index) => {
                              const customColor = tagColors[filter.text.toLowerCase()] || (filter.mode === "include" ? "#4CAF50" : "#F44336");
                              return (
                                  <div key={index} className="cl-filter-badge" style={{
                                      background: filter.mode === "include" ? "var(--bg-success-light, #1b3a24)" : "var(--bg-danger-light, #3a1b1b)",
                                      borderColor: customColor
                                  }}>
                                      <span className="cl-filter-badge-text" style={{ color: customColor }}>
                                          {filter.text.toUpperCase()}
                                      </span>
                                      <button 
                                          onClick={() => toggleTagMode(index)} 
                                          className="cl-filter-badge-btn"
                                          style={{ color: filter.mode === "include" ? "#4CAF50" : "#F44336" }}
                                          title="Basculer entre Inclus (EST) et Exclus (NON)"
                                      >
                                          {filter.mode === "include" ? "EST" : "NON"}
                                      </button>
                                      <button onClick={() => removeTagFilter(index)} className="cl-filter-badge-close">✕</button>
                                  </div>
                              )
                          })}
                      </div>
                  </div>

                  <div className="cl-field-container">
                      <label className="cl-label">Légalité</label>
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
                          <label className="cl-label">Force</label>
                          <div style={{display: "flex"}}>
                              <select value={powerOp} onChange={(e) => setPowerOp(e.target.value)} className="custom-select select-prefix">
                                  <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option>
                              </select>
                              <input type="text" value={powerFilter} onChange={(e) => setPowerFilter(e.target.value)} className="custom-input input-suffix" />
                          </div>
                      </div>
                      <div style={{ flex: 1 }}>
                          <label className="cl-label">Endu.</label>
                          <div style={{display: "flex"}}>
                              <select value={toughnessOp} onChange={(e) => setToughnessOp(e.target.value)} className="custom-select select-prefix">
                                  <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option>
                              </select>
                              <input type="text" value={toughnessFilter} onChange={(e) => setToughnessFilter(e.target.value)} className="custom-input input-suffix" />
                          </div>
                      </div>
                  </div>

                  <div className="cl-field-container cl-sort-section">
                      <label className="cl-label">Trier par</label>
                      <div className="cl-sort-wrapper">
                          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="custom-select" style={{ flex: 1 }}>
                              <option value="name">Nom</option>
                              <option value="count">Quantité possédée</option>
                              <option value="price">Prix estimé</option>
                              <option value="set">Extension (Grille)</option>
                              <option value="tags">Tags (Grille)</option>
                          </select>
                          <button 
                              onClick={() => setSortDir(sortDir === 1 ? -1 : 1)} 
                              className="btn-secondary cl-btn-sort-dir"
                              title={sortDir === 1 ? "Croissant (Vieux -> Récent / A-Z)" : "Décroissant (Récent -> Vieux / Z-A)"}
                          >
                              {sortDir === 1 ? "v" : "^"}
                          </button>
                      </div>
                  </div>
                  
                  <div style={{ height: "10px" }}></div>
              </div>

              <div className="cl-sidebar-footer">
                 <p className="cl-sidebar-footer-text">Cartes affichées : <strong>{cards.length}</strong></p>
              </div>
            </div>

            {/* ZONE DE RÉSULTATS DROITE */}
            <div className="cl-results-wrapper">
              
              {setFilter && sortBy !== "set" && sortBy !== "tags" && (
                  <div className="cl-active-set-banner">
                      <div className="cl-active-set-badge">
                          Extension filtrée : <span style={{ color: "var(--primary)", marginLeft: "5px" }}>{setFilter.toUpperCase()}</span>
                          <button onClick={() => setSetFilter("")} className="cl-active-set-close" title="Retirer ce filtre">✕</button>
                      </div>
                  </div>
              )}

              <div className="cl-scrollable-area">
                  {sortBy === "set" ? (
                      <div className="cl-sets-grid">
                          {loading ? (
                              <div className="cl-empty-msg">Chargement des extensions...</div>
                          ) : userSets.length === 0 ? (
                              <div className="cl-empty-msg">Aucune extension trouvée.</div>
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
                                                  <div className="cl-set-year-header">{setYear}</div>
                                              )}
                                              <div 
                                                  onClick={() => { setSetFilter(set.set_code); setSortBy("name"); }} 
                                                  className="cl-set-item"
                                              >
                                                  <img src={`https://svgs.scryfall.io/sets/${set.set_code}.svg`} alt={set.set_name} className="cl-set-icon" onError={(e) => e.target.style.display = 'none'} />
                                                  <div className="cl-set-info">
                                                      <span className="cl-set-name" title={set.set_name}>{set.set_name}</span>
                                                      <span className="cl-set-count">{set.count} carte{set.count > 1 ? 's' : ''}</span>
                                                  </div>
                                              </div>
                                          </React.Fragment>
                                      );
                                  });
                              })()
                          )}
                      </div>
                  ) : sortBy === "tags" ? (
                      <div className="cl-tags-grid">
                          {loading ? (
                              <div className="cl-empty-msg">Chargement des tags...</div>
                          ) : tagsSummary.length === 0 ? (
                              <div className="cl-empty-msg">Aucun tag trouvé.</div>
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
                                           className="cl-tag-item"
                                           style={{ '--tag-color': currentTagColor }}
                                      >
                                          <h3 className="cl-tag-title">{tagObj.tag_name}</h3>
                                          <div className="cl-tag-count">{tagObj.count} carte{tagObj.count > 1 ? 's' : ''}</div>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                  ) : (
                      <div className="cl-cards-grid">
                          {cards.map((card, index) => (
                              <div 
                                ref={cards.length === index + 1 ? lastCardElementRef : null} 
                                key={card._id || `${card.id}_${card.is_foil}`} 
                                className="cl-card-item"
                                onClick={() => setSelectedCard({ id: card.id || card._id, is_foil: card.is_foil })} 
                              >
                                 <div className="cl-card-content">
                                      <div className="cl-card-img-wrapper">
                                        {card.image_normal ? (
                                          <img src={card.image_normal} alt={card.name} className="cl-card-img" loading="lazy" />
                                        ) : (
                                          <div className="cl-card-no-img">Pas d'image</div>
                                        )}
                                      </div>
                                      
                                      <div className="cl-card-info-wrapper">
                                          <div className="cl-card-title-row" title={card.name}>
                                            {card.name}
                                            {card.is_foil && <span className="cl-card-foil-badge">F</span>}
                                          </div>
                                          <div className="cl-card-meta-row">
                                              <span className="cl-card-set-text" title={card.set_name}>
                                                  {sortBy === "price" ? (
                                                      card.prices?.eur ? <span className="cl-card-price">{card.prices.eur} €</span> : "N/A"
                                                  ) : (
                                                      card.set_name || "?"
                                                  )}
                                              </span>
                                              <span className="cl-card-qty">x{card.count || 1}</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {loading && <div className="cl-empty-msg">Chargement...</div>}
                          {!loading && cards.length === 0 && <div className="cl-empty-msg mt">Aucune carte trouvée.</div>}
                      </div>
                  )}
              </div>
            </div>
          </div>

          {selectedCard && (
            <CardModal 
              cardId={selectedCard.id} 
              isFoil={selectedCard.is_foil}
              defaultCount={cards[selectedIndex]?.count || 1}
              tagColors={tagColors}
              onClose={handleCloseModal} 
              onNext={handleNextCard}
              onPrev={handlePrevCard}
              hasNext={hasNextCard}
              hasPrev={hasPrevCard}
            />
          )}
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