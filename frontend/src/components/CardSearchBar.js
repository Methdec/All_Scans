import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import "../theme.css";
import CardGrid from "./CardGrid";
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
  
  const hasAdvancedParams = typeTags.length > 0 || keywordTags.length > 0 || searchParams.get("set_name");
  const [showAdvanced, setShowAdvanced] = useState(!!hasAdvancedParams);

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
          className="custom-input"
        />
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
            {tags.map((tag, index) => (
              <div
                key={index}
                onClick={() => toggleExclusion(index)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px",
                  borderRadius: "4px", border: `1px solid ${tag.isExcluded ? "#f44336" : "#4CAF50"}`,
                  backgroundColor: "rgba(0,0,0,0.3)", cursor: "pointer", fontSize: "0.85rem", userSelect: "none"
                }}
              >
                <span style={{ color: "var(--text-main)" }}>{tag.text}</span>
                <span style={{ fontWeight: "bold", color: tag.isExcluded ? "#f44336" : "#4CAF50" }}>
                  {tag.isExcluded ? "NON" : "EST"}
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); removeTag(index); }}
                  style={{ color: "var(--text-muted)", paddingLeft: "4px", paddingRight: "4px", fontSize: "1.1rem" }}
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
        src={MANA_SYMBOLS[code]} alt={alt} onClick={() => toggleColor(code)}
        style={{ 
            width: "32px", height: "32px", cursor: "pointer", borderRadius: "50%", 
            border: isSelected ? "3px solid #FF9800" : "2px solid transparent", 
            transform: isSelected ? "scale(1.1)" : "scale(1)", opacity: isSelected ? 1 : 0.6, transition: "all 0.2s" 
        }}
      />
    );
  };

  const customStyles = `
    .custom-select {
      appearance: none; background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff);
      border: 1px solid var(--border, #444); padding: 8px 30px 8px 10px; border-radius: 4px;
      font-size: 0.9rem; width: 100%; cursor: pointer; box-sizing: border-box;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
      background-repeat: no-repeat; background-position: right 8px center; background-size: 20px; transition: all 0.2s ease;
    }
    .custom-select:hover, .custom-select:focus { border-color: #FF9800; outline: none; }
    .custom-input {
      width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border, #444);
      background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); font-size: 0.9rem;
      box-sizing: border-box; outline: none; transition: border-color 0.2s;
    }
    .custom-input:hover, .custom-input:focus { border-color: #FF9800; }
    .btn-submit {
      width: 100%; padding: 12px; background: var(--primary, #FF9800); color: white; border: none;
      border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: all 0.2s; margin-top: 10px;
    }
    .btn-submit:hover { background: #e68a00; }
    .btn-submit:disabled { background: #555; color: #888; cursor: not-allowed; }
    .toggle-advanced {
      background: transparent; border: none; color: var(--primary, #FF9800); cursor: pointer;
      font-size: 0.85rem; text-decoration: underline; padding: 0; margin-top: 5px; margin-bottom: 15px;
    }
  `;

  const fieldContainerStyle = { marginBottom: "15px" };
  const labelStyle = { display: "block", marginBottom: "5px", fontSize: "0.85rem", color: "var(--text-muted, #aaa)", fontWeight: "600" };

  // --- LOGIQUE CAROUSEL ---
  const selectedIndex = results.findIndex(c => c.id === selectedCard?.id);
  const hasPrevCard = selectedIndex > 0;
  const hasNextCard = selectedIndex !== -1 && selectedIndex < results.length - 1;

  const handlePrevCard = () => {
    if (hasPrevCard) setSelectedCard(results[selectedIndex - 1]);
  };

  const handleNextCard = () => {
    if (hasNextCard) setSelectedCard(results[selectedIndex + 1]);
  };

  return (
    <div className="split-layout" style={{ height: "calc(100vh - 60px)", overflow: "hidden" }}>
      <style>{customStyles}</style>

      {/* BARRE LATÉRALE GAUCHE (Filtres) */}
      <div className="sidebar-filters" style={{ height: "100%", padding: 0, overflowY: "auto", overflowX: "hidden", borderRight: "1px solid var(--border)" }}>
        <form onSubmit={handleSearchSubmit} style={{ padding: "20px" }}>
          <div className="sidebar-title" style={{ marginBottom: "20px" }}>Recherche Scryfall</div>

          <div style={fieldContainerStyle}>
            <label style={labelStyle}>Nom de la carte</label>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." className="custom-input" />
          </div>

          <div style={fieldContainerStyle}>
            <div style={{display: "flex", alignItems: "center", marginBottom: "5px", justifyContent: "space-between"}}>
                <label style={{...labelStyle, marginBottom: 0}}>Couleurs</label>
                <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} className="custom-select" style={{ width: "auto", padding: "2px 25px 2px 8px", fontSize: "0.75rem", height: "auto" }}>
                    <option value="exact">Exacte</option>
                    <option value="subset">Approx.</option>
                </select>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", background: "var(--bg-input, rgba(0,0,0,0.2))", padding: "10px", borderRadius: "4px" }}>
                {Object.keys(MANA_SYMBOLS).map(c => <ManaSymbol key={c} code={c} alt={c} />)}
            </div>
          </div>

          <div style={fieldContainerStyle}>
            <label style={labelStyle}>Rareté</label>
            <select name="rarity" value={filters.rarity} onChange={handleChange} className="custom-select">
              <option value="">Toutes</option>
              <option value="common">Commune</option>
              <option value="uncommon">Peu commune</option>
              <option value="rare">Rare</option>
              <option value="mythic">Mythique</option>
            </select>
          </div>

          <button type="button" className="toggle-advanced" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? "Masquer les filtres avancés" : "+ Afficher les filtres avancés"}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: "10px", paddingTop: "15px", borderTop: "1px dashed var(--border)" }}>

              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Type(s)</label>
                {renderTagInput(typeInput, setTypeInput, typeTags, setTypeTags, "Ex: Creature (Entrée)")}
              </div>

              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Mot(s) clé(s)</label>
                {renderTagInput(keywordInput, setKeywordInput, keywordTags, setKeywordTags, "Ex: Flying (Entrée)")}
              </div>

              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Édition</label>
                <input type="text" name="set_name" value={filters.set_name} onChange={handleChange} placeholder="Code (ex: khm)" className="custom-input" />
              </div>

              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Coût de mana (CMC)</label>
                <input type="number" name="cmc" value={filters.cmc} onChange={handleChange} placeholder="Ex: 3" className="custom-input" />
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Force</label>
                  <input type="text" name="power" value={filters.power} onChange={handleChange} placeholder="Ex: 3" className="custom-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Endu.</label>
                  <input type="text" name="toughness" value={filters.toughness} onChange={handleChange} placeholder="Ex: 4" className="custom-input" />
                </div>
              </div>

              <div style={fieldContainerStyle}>
                <label style={labelStyle}>Légalité</label>
                <div style={{ display: "flex", gap: "5px" }}>
                  <div style={{ flex: 2 }}>
                    <select name="legality" value={filters.legality} onChange={handleChange} className="custom-select" style={{ paddingLeft: "5px" }}>
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
                    <select name="legalityType" value={filters.legalityType} onChange={handleChange} className="custom-select" style={{ paddingLeft: "5px" }}>
                      <option value="legal">Légal</option>
                      <option value="not">Banni</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          <div style={{ marginTop: "30px", paddingBottom: "20px" }}>
            <button type="submit" className="btn-submit" disabled={loading}>
              Rechercher
            </button>
          </div>
        </form>
      </div>

      {/* ZONE DE RÉSULTATS DROITE */}
      <div className="results-area" style={{ overflowY: "auto", position: "relative" }}>
        
        {loading ? (
          <Loader />
        ) : (
          <>
            {error && <div style={{ color: "var(--danger)", padding: "20px", textAlign: "center", fontWeight: "bold" }}>{error}</div>}
            
            {!error && results.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 50, color: "var(--text-muted)" }}>
                Saisissez des critères de recherche pour explorer Scryfall.
              </div>
            )}

            {results.length > 0 && (
              <div style={{ padding: "20px" }}>
                <CardGrid
                  cards={results}
                  onCardClick={(cardId) => {
                    const card = results.find(c => c.id === cardId);
                    if (card) setSelectedCard(card);
                  }}
                  renderAction={null}
                />
              </div>
            )}
          </>
        )}

        {!loading && results.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", padding: "20px", borderTop: "1px solid var(--border)", background: "var(--bg-main)" }}>
            <button 
              className="custom-input" 
              style={{ width: "auto", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }} 
              onClick={handlePrevPage} 
              disabled={currentPage === 1}
            >
              ← Précédent
            </button>
            <span style={{ color: "var(--text-main)", fontWeight: "bold" }}>Page {currentPage}</span>
            <button 
              className="custom-input" 
              style={{ width: "auto", cursor: !hasMore ? "not-allowed" : "pointer", opacity: !hasMore ? 0.5 : 1 }} 
              onClick={handleNextPage} 
              disabled={!hasMore}
            >
              Suivant →
            </button>
          </div>
        )}
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