import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import "../theme.css";
import CardSearchDetailModal from "./CardSearchDetailModal";
import Loader from "./Loader"; 

const MANA_SYMBOLS = {
  W: "https://svgs.scryfall.io/card-symbols/W.svg",
  U: "https://svgs.scryfall.io/card-symbols/U.svg",
  B: "https://svgs.scryfall.io/card-symbols/B.svg",
  R: "https://svgs.scryfall.io/card-symbols/R.svg",
  G: "https://svgs.scryfall.io/card-symbols/G.svg",
  C: "https://svgs.scryfall.io/card-symbols/C.svg"
};

const parseTags = (str) => {
  if (!str) return [];
  return str.split(',').map(t => {
    if (t.startsWith('-')) return { text: t.substring(1), isExcluded: true };
    return { text: t, isExcluded: false };
  });
};

const serializeTags = (tags) => {
  return tags.map(t => t.isExcluded ? `-${t.text}` : t.text).join(',');
};

export default function CardSearchBar() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [colorMode, setColorMode] = useState(searchParams.get("colorMode") || "exact");
  
  const [typeTags, setTypeTags] = useState(parseTags(searchParams.get("typeTags")));
  const [keywordTags, setKeywordTags] = useState(parseTags(searchParams.get("keywordTags")));
  
  const [typeInput, setTypeInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const [filters, setFilters] = useState({
    colors: searchParams.get("colors") || "",
    set_name: searchParams.get("set_name") || "",
    cmc: searchParams.get("cmc") || "",
    power: searchParams.get("power") || "",
    toughness: searchParams.get("toughness") || "",
    rarity: searchParams.get("rarity") || "",
    legality: searchParams.get("legality") || "",
    legalityType: searchParams.get("legalityType") || "legal",
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  
  // État pour gérer l'affichage du panneau de filtres sur mobile
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const currentPage = parseInt(searchParams.get("page")) || 1;
  const [hasMore, setHasMore] = useState(false);

  const fetchCards = useCallback(async () => {
    let searchParts = [];
    
    const pQuery = searchParams.get("query") || "";
    const pColors = searchParams.get("colors") || "";
    const pColorMode = searchParams.get("colorMode") || "exact";
    const pTypeTags = parseTags(searchParams.get("typeTags"));
    const pKeywordTags = parseTags(searchParams.get("keywordTags"));
    const pSetName = searchParams.get("set_name") || "";
    const pCmc = searchParams.get("cmc") || "";
    const pPower = searchParams.get("power") || "";
    const pToughness = searchParams.get("toughness") || "";
    const pRarity = searchParams.get("rarity") || "";
    const pLegality = searchParams.get("legality") || "";
    const pLegalityType = searchParams.get("legalityType") || "legal";

    if (pQuery) searchParts.push(pQuery);
    
    if (pColors) {
      const colorStr = pColors.replace(/,/g, ""); 
      if (colorStr.includes("C")) {
        searchParts.push(`color=c`);
      } else {
        if (pColorMode === "exact") searchParts.push(`color=${colorStr}`);
        else searchParts.push(`color<=${colorStr}`);
      }
    }

    pTypeTags.forEach(tag => searchParts.push(`${tag.isExcluded ? '-' : ''}type:${tag.text}`));
    pKeywordTags.forEach(tag => searchParts.push(`${tag.isExcluded ? '-' : ''}keyword:${tag.text}`));

    if (pSetName) searchParts.push(`set:${pSetName}`);
    if (pCmc) searchParts.push(`cmc=${pCmc}`);
    if (pPower) searchParts.push(`power=${pPower}`);
    if (pToughness) searchParts.push(`toughness=${pToughness}`);
    if (pRarity) searchParts.push(`rarity:${pRarity}`);
    if (pLegality) {
      const prefix = pLegalityType === "not" ? "not" : "legal";
      searchParts.push(`${prefix}:${pLegality}`);
    }

    const finalQuery = searchParts.join(" ");

    if (!finalQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}&page=${currentPage}`);
      const data = await res.json();

      if (data.object === "error") {
        if (data.details.includes("didn't match any cards")) setError("Aucun résultat trouvé pour cette recherche.");
        else setError(data.details);
        setResults([]);
        setHasMore(false);
      } else {
        setResults(data.data || []);
        setHasMore(data.has_more || false);
      }
    } catch (err) {
      setError("Erreur lors de la recherche.");
    }

    setLoading(false);
  }, [searchParams, currentPage]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (colorMode) params.set("colorMode", colorMode);
    
    if (typeTags.length > 0) params.set("typeTags", serializeTags(typeTags));
    if (keywordTags.length > 0) params.set("keywordTags", serializeTags(keywordTags));

    Object.keys(filters).forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });

    params.set("page", 1);
    setSearchParams(params);
    
    // Ferme le panneau mobile une fois la recherche validée
    setShowMobileFilters(false);
  };

  const handleNextPage = () => {
    if (!hasMore) return;
    const params = new URLSearchParams(searchParams);
    params.set("page", currentPage + 1);
    setSearchParams(params);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    const params = new URLSearchParams(searchParams);
    params.set("page", currentPage - 1);
    setSearchParams(params);
  };

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const toggleColor = (colorCode) => {
    let currentColors = filters.colors ? filters.colors.split(",") : [];
    if (colorCode === "C") {
        if (currentColors.includes("C")) setFilters({...filters, colors: ""});
        else setFilters({...filters, colors: "C"});
        return;
    }
    if (currentColors.includes("C")) currentColors = [];
    if (currentColors.includes(colorCode)) {
        currentColors = currentColors.filter(c => c !== colorCode);
    } else {
        currentColors.push(colorCode);
    }
    setFilters({...filters, colors: currentColors.join(",")});
  };

  const renderTagInput = (inputVal, setInputVal, tags, setTags, placeholder) => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputVal.trim();
        if (val && !tags.find(t => t.text.toLowerCase() === val.toLowerCase())) {
          setTags([...tags, { text: val, isExcluded: false }]);
          setInputVal("");
        }
      }
    };

    const toggleExclusion = (index) => {
      const newTags = [...tags];
      newTags[index].isExcluded = !newTags[index].isExcluded;
      setTags(newTags);
    };

    const removeTag = (index) => {
      setTags(tags.filter((_, i) => i !== index));
    };

    return (
      <div>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input-field"
        />
        {tags.length > 0 && (
          <div className="flex gap-8 flex-wrap mt-8">
            {tags.map((tag, index) => (
              <div
                key={index}
                onClick={() => toggleExclusion(index)}
                className={`search-tag ${tag.isExcluded ? 'search-tag-exclude' : 'search-tag-include'}`}
              >
                <span className="search-tag-text">{tag.text}</span>
                <span className={tag.isExcluded ? 'search-tag-status-exclude' : 'search-tag-status-include'}>
                  {tag.isExcluded ? "NON" : "EST"}
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); removeTag(index); }}
                  className="search-tag-remove"
                >
                  ✕
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ManaSymbol = ({ code, alt }) => {
    const isSelected = filters.colors.split(",").includes(code);
    return (
      <img 
        src={MANA_SYMBOLS[code]} 
        alt={alt} 
        onClick={() => toggleColor(code)}
        className={`mana-symbol-filter ${isSelected ? 'selected' : ''}`}
      />
    );
  };

  // --- LOGIQUE CAROUSEL ---
  const selectedIndex = results.findIndex(c => c.id === selectedCard?.id);
  const hasPrevCard = selectedIndex > 0;
  const hasNextCard = selectedIndex !== -1 && selectedIndex < results.length - 1;

  const handlePrevCard = () => { if (hasPrevCard) setSelectedCard(results[selectedIndex - 1]); };
  const handleNextCard = () => { if (hasNextCard) setSelectedCard(results[selectedIndex + 1]); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* --- RECHERCHE MOBILE (Visible uniquement sur mobile via CSS) --- */}
      <div className="mobile-search-header">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
          placeholder="Rechercher une carte..."
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

      {/* CONTENEUR SPLIT (Scrolls indépendants) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", width: "100%" }}>
        
        {/* BARRE LATÉRALE GAUCHE (Filtres complets) */}
        <div className={`sidebar-filters ${showMobileFilters ? "mobile-expanded" : ""}`}>
          <form onSubmit={handleSearchSubmit}>
            <div className="sidebar-title mb-20">Recherche Scryfall</div>

            <div className="search-field-group desktop-only-search">
              <label className="search-field-label">Nom de la carte</label>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." className="input-field" />
            </div>

            <div className="search-field-group">
              <div className="flex items-center justify-between mb-5">
                  <label className="search-field-label m-0">Couleurs</label>
                  <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="select-field" style={{ width: "auto", padding: "2px 25px 2px 8px", fontSize: "0.75rem", height: "auto" }}>
                      <option value="exact">Exacte</option>
                      <option value="subset">Approx.</option>
                  </select>
              </div>
              <div className="flex gap-10 flex-wrap justify-center p-10" style={{ background: "var(--bg-input)", borderRadius: "4px" }}>
                  {Object.keys(MANA_SYMBOLS).map(c => <ManaSymbol key={c} code={c} alt={c} />)}
              </div>
            </div>

            <div className="search-field-group">
              <label className="search-field-label">Rareté</label>
              <select name="rarity" value={filters.rarity} onChange={handleChange} className="select-field">
                <option value="">Toutes</option>
                <option value="common">Commune</option>
                <option value="uncommon">Peu commune</option>
                <option value="rare">Rare</option>
                <option value="mythic">Mythique</option>
              </select>
            </div>

            {/* Tous les filtres avancés affichés directement */}
            <div className="search-advanced-section" style={{ borderTop: "none", paddingTop: "0", marginTop: "15px" }}>

              <div className="search-field-group">
                <label className="search-field-label">Type(s)</label>
                {renderTagInput(typeInput, setTypeInput, typeTags, setTypeTags, "Ex: Creature (Entrée)")}
              </div>

              <div className="search-field-group">
                <label className="search-field-label">Mot(s) clé(s)</label>
                {renderTagInput(keywordInput, setKeywordInput, keywordTags, setKeywordTags, "Ex: Flying (Entrée)")}
              </div>

              <div className="search-field-group">
                <label className="search-field-label">Édition</label>
                <input type="text" name="set_name" value={filters.set_name} onChange={handleChange} placeholder="Code (ex: khm)" className="input-field" />
              </div>

              <div className="search-field-group">
                <label className="search-field-label">Coût de mana (CMC)</label>
                <input type="number" name="cmc" value={filters.cmc} onChange={handleChange} placeholder="Ex: 3" className="input-field" />
              </div>

              <div className="flex gap-10 mb-15">
                <div className="flex-1">
                  <label className="search-field-label">Force</label>
                  <input type="text" name="power" value={filters.power} onChange={handleChange} placeholder="Ex: 3" className="input-field" />
                </div>
                <div className="flex-1">
                  <label className="search-field-label">Endu.</label>
                  <input type="text" name="toughness" value={filters.toughness} onChange={handleChange} placeholder="Ex: 4" className="input-field" />
                </div>
              </div>

              <div className="search-field-group">
                <label className="search-field-label">Légalité</label>
                <div className="flex gap-5">
                  <div style={{ flex: 2 }}>
                    <select name="legality" value={filters.legality} onChange={handleChange} className="select-field" style={{ paddingLeft: "5px" }}>
                      <option value="">Tous formats</option>
                      <option value="standard">Standard</option>
                      <option value="modern">Modern</option>
                      <option value="commander">Commander</option>
                      <option value="vintage">Vintage</option>
                      <option value="pioneer">Pioneer</option>
                      <option value="pauper">Pauper</option>
                    </select>
                  </div>
                  <div style={{ flex: 1.2 }}>
                    <select name="legalityType" value={filters.legalityType} onChange={handleChange} className="select-field" style={{ paddingLeft: "5px" }}>
                      <option value="legal">Légal</option>
                      <option value="not">Banni</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ marginTop: "10px", paddingBottom: "20px" }}>
              <button type="submit" className="btn-primary w-full p-12 text-lg" disabled={loading}>
                Rechercher
              </button>
            </div>
          </form>
        </div>

        {/* ZONE DE RÉSULTATS DROITE */}
        <div className="results-area scroll-area">
          {loading ? (
            <Loader />
          ) : (
            <>
              {error && <div className="text-center font-bold p-20 text-danger">{error}</div>}
              
              {!error && results.length === 0 && (
                <div className="text-center mt-auto" style={{ paddingTop: 50, color: "var(--text-muted)" }}>
                  Saisissez des critères de recherche pour explorer Scryfall.
                </div>
              )}

              {results.length > 0 && (
                <div className="cl-cards-grid">
                  {results.map((card) => {
                    const imageUrl = card.image_uris?.normal || card.image_uris?.border_crop || (card.card_faces && card.card_faces[0]?.image_uris?.normal);
                    return (
                      <div key={card.id} className="cl-card-item" onClick={() => setSelectedCard(card)}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          
                          <div style={{ position: "relative", width: "100%", marginBottom: "8px" }}>
                            {imageUrl ? (
                              <img src={imageUrl} alt={card.name} className="cl-card-img" loading="lazy" />
                            ) : (
                              <div style={{ width: "100%", aspectRatio: "2.5/3.5", backgroundColor: "#333", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: "0.8rem" }}>No Img</div>
                            )}
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
                            <div className="font-bold card-text-truncate" title={card.name}>
                              {card.name}
                            </div>
                            <div className="text-muted card-text-truncate-sm" title={card.set_name}>
                              {card.set_name || "?"}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!loading && results.length > 0 && (
            <div className="search-pagination">
              <button 
                className="input-field" 
                style={{ width: "auto", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }} 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
              >
                ← Précédent
              </button>
              <span className="font-bold" style={{ color: "var(--text-main)" }}>Page {currentPage}</span>
              <button 
                className="input-field" 
                style={{ width: "auto", cursor: !hasMore ? "not-allowed" : "pointer", opacity: !hasMore ? 0.5 : 1 }} 
                onClick={handleNextPage} 
                disabled={!hasMore}
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedCard && (
        <CardSearchDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onNext={handleNextCard}
          onPrev={handlePrevCard}
          hasNext={hasNextCard}
          hasPrev={hasPrevCard}
        />
      )}
    </div>
  );
}