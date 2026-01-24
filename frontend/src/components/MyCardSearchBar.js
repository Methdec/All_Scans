import { useState, useEffect, useCallback, useRef } from "react";
import "../theme.css";

export default function MyCardSearchBar({ onResults, totalCards = 0, filteredCards = 0 }) {
  const [searchParams, setSearchParams] = useState({
    name: "", exact_name: "", rarity: "", colors: "", color_identity: "",
    type_line: "", cmc: "", power: "", toughness: "", sort_by: "name", sort_order: "asc",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  // --- LOGIQUE DE RECHERCHE RESTAURÉE ---
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && value.trim() !== "") params.append(key, value.trim());
    });
    params.append("limit", 60);

    const hasFilters = Array.from(params.entries()).length > 0;
    setSearchActive(hasFilters);

    try {
      const url = hasFilters
        ? `http://localhost:8000/usercards?${params.toString()}`
        : "http://localhost:8000/usercards";

      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) {
        setError("Connexion requise.");
        return;
      }
      if (!res.ok) throw new Error("Erreur serveur");

      const data = await res.json();
      // On renvoie les résultats au parent (CardsList)
      onResults(data.cards || [], hasFilters, searchParams);

    } catch (err) {
      console.error("Erreur recherche:", err);
      setError("Erreur lors de la recherche");
      onResults([], false, searchParams);
    } finally {
      setLoading(false);
    }
  }, [searchParams, onResults]);

  // Déclencheur automatique (Debounce)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => { handleSearch(); }, 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [handleSearch]);

  const clearFilters = () => {
    setSearchParams({
      name: "", exact_name: "", rarity: "", colors: "", color_identity: "",
      type_line: "", cmc: "", power: "", toughness: "", sort_by: "name", sort_order: "asc",
    });
  };

  const applyQuickSearch = (quickSearch) => {
    setSearchParams(prev => ({ ...prev, ...quickSearch.params }));
  };

  return (
    <div className="search-container" style={{background: "var(--bg-card)", padding: 20, borderRadius: "var(--radius)", marginBottom: 20, border: "1px solid var(--border)"}}>
      
      {/* Stats */}
      <div style={{ marginBottom: 15, color: "var(--text-muted)" }}>
        Affichage : <strong style={{color: "var(--text-main)"}}>{filteredCards}</strong> / {totalCards} cartes
      </div>

      {/* Filtres actifs */}
      {searchActive && (
        <div style={{ marginBottom: 15, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {Object.entries(searchParams)
            .filter(([k, v]) => v && v.trim() !== "")
            .map(([k, v]) => (
              <span key={k} className="filter-badge">
                {k}: {v}
                <span onClick={() => setSearchParams(prev => ({ ...prev, [k]: "" }))} style={{cursor:"pointer", marginLeft:5}}>✕</span>
              </span>
            ))}
        </div>
      )}

      {/* Boutons Rapides */}
      <div style={{ marginBottom: 15, display: "flex", gap: 10 }}>
        <button type="button" className="btn-secondary" onClick={() => applyQuickSearch({ params: { rarity: 'mythic' } })}>Mythiques</button>
        <button type="button" className="btn-secondary" onClick={() => applyQuickSearch({ params: { type_line: 'Creature', colors: 'G' } })}>Créatures Vertes</button>
      </div>

      {/* Formulaire */}
      <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 15 }}>
          <input type="text" name="name" value={searchParams.name} onChange={handleInputChange} placeholder="Rechercher une carte..." style={{ flex: 1, minWidth: 200 }} />
          
          <select name="rarity" value={searchParams.rarity} onChange={handleInputChange}>
            <option value="">Rareté</option>
            <option value="common">Commune</option>
            <option value="uncommon">Peu commune</option>
            <option value="rare">Rare</option>
            <option value="mythic">Mythique</option>
          </select>

          <input type="text" name="colors" value={searchParams.colors} onChange={handleInputChange} placeholder="Couleurs (W,U...)" style={{ width: 120 }} />
          
          <button type="button" className="btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? "Moins" : "Filtres"}
          </button>
        </div>

        {showAdvanced && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 15, padding: 15, background: "var(--bg-main)", borderRadius: 8 }}>
             <input type="number" name="cmc" placeholder="CMC" value={searchParams.cmc} onChange={handleInputChange} style={{width: 80}} />
             <input type="text" name="type_line" placeholder="Type" value={searchParams.type_line} onChange={handleInputChange} />
             <input type="text" name="exact_name" placeholder="Nom exact" value={searchParams.exact_name} onChange={handleInputChange} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "..." : "Rechercher"}
            </button>
            <button type="button" onClick={clearFilters} className="btn-danger">
                Effacer
            </button>
        </div>
      </form>
    </div>
  );
}