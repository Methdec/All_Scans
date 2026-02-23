import { useState, useEffect, useCallback, useRef } from "react";
import "../theme.css";

export default function MyCardSearchBar({ onResults, totalCards = 0, filteredCards = 0, onImportClick }) {
  const [searchParams, setSearchParams] = useState({
    // Paramètres de base
    name: "", rarity: "", colors: "",
    // Paramètres avancés
    oracle_text: "", type_line: "", cmc: "", 
    power: "", power_op: "=", 
    toughness: "", toughness_op: "=", 
    format_legality: "", is_legal: "",
    // Tri
    sort_by: "name", sort_order: "asc",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  // --- LOGIQUE DE RECHERCHE ---
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      // On n'envoie les opérateurs que si une force/endurance a été saisie
      if (key === "power_op" && !searchParams.power) return;
      if (key === "toughness_op" && !searchParams.toughness) return;

      if (value && value.trim() !== "") params.append(key, value.trim());
    });
    
    // On peut augmenter la limite si besoin
    params.append("limit", 60);

    const hasFilters = Array.from(params.entries()).length > 0;
    setSearchActive(hasFilters);

    try {
      // Ajuste l'URL si ta route s'appelle autrement (ex: /cards/search au lieu de /usercards)
      const url = hasFilters
        ? `http://localhost:8000/cards/search?${params.toString()}`
        : `http://localhost:8000/cards/search`;

      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) {
        setError("Connexion requise.");
        return;
      }
      if (!res.ok) throw new Error("Erreur serveur");

      const data = await res.json();
      onResults(data.cards || [], hasFilters, searchParams);

    } catch (err) {
      console.error("Erreur recherche:", err);
      setError("Erreur lors de la recherche");
      onResults([], false, searchParams);
    } finally {
      setLoading(false);
    }
  }, [searchParams, onResults]);

  // Déclencheur automatique (Debounce de 500ms pour ne pas spammer le serveur)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => { handleSearch(); }, 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [handleSearch]);

  const clearFilters = () => {
    setSearchParams({
      name: "", rarity: "", colors: "", oracle_text: "", type_line: "", cmc: "", 
      power: "", power_op: "=", toughness: "", toughness_op: "=", 
      format_legality: "", is_legal: "", sort_by: "name", sort_order: "asc",
    });
  };

  const applyQuickSearch = (quickSearch) => {
    setSearchParams(prev => ({ ...prev, ...quickSearch.params }));
  };

  return (
    // On utilise flex-direction: column et une hauteur de 100vh pour que le bouton d'import reste en bas
    <div className="search-sidebar" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", position: "sticky", top: 20 }}>
      
      {/* --- ZONE SCROLLABLE POUR LES FILTRES --- */}
      <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
        
        {/* Stats */}
        <div style={{ marginBottom: 15, color: "var(--text-muted)" }}>
          Affichage : <strong style={{color: "var(--text-main)"}}>{filteredCards}</strong> / {totalCards} cartes
        </div>

        {/* Boutons Rapides */}
        <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={() => applyQuickSearch({ params: { rarity: 'mythic' } })}>Mythiques</button>
          <button type="button" className="btn-secondary" onClick={() => applyQuickSearch({ params: { type_line: 'Creature', colors: 'G' } })}>Créatures Vertes</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
          
          {/* --- PARAMÈTRES DE BASE --- */}
          <h4 style={{ color: "var(--text-main)", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>Recherche basique</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <input type="text" name="name" value={searchParams.name} onChange={handleInputChange} placeholder="Nom de la carte..." style={{ width: "100%" }} />
            
            <div style={{ display: "flex", gap: 10 }}>
              <select name="rarity" value={searchParams.rarity} onChange={handleInputChange} style={{ flex: 1 }}>
                <option value="">Rareté</option>
                <option value="common">Commune</option>
                <option value="uncommon">Peu commune</option>
                <option value="rare">Rare</option>
                <option value="mythic">Mythique</option>
              </select>
              <input type="text" name="colors" value={searchParams.colors} onChange={handleInputChange} placeholder="Couleurs (W,U...)" style={{ flex: 1 }} />
            </div>
          </div>

          {/* --- PARAMÈTRES AVANCÉS --- */}
          <h4 style={{ color: "var(--text-main)", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>Paramètres avancés</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            
            <input type="text" name="oracle_text" value={searchParams.oracle_text} onChange={handleInputChange} placeholder="Texte (ex: draw a card)" style={{ width: "100%" }} />
            
            <div style={{ display: "flex", gap: 10 }}>
              <input type="text" name="type_line" placeholder="Type (ex: Creature)" value={searchParams.type_line} onChange={handleInputChange} style={{flex: 2}} />
              <input type="number" name="cmc" placeholder="CMC" value={searchParams.cmc} onChange={handleInputChange} style={{flex: 1}} />
            </div>

            {/* Force */}
            <div style={{ display: "flex" }}>
              <select name="power_op" value={searchParams.power_op} onChange={handleInputChange} style={{ width: 60, borderRadius: "4px 0 0 4px", borderRight: "none" }}>
                <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option><option value="<=">&le;</option>
              </select>
              <input type="text" name="power" placeholder="Force (ex: 4)" value={searchParams.power} onChange={handleInputChange} style={{ flex: 1, borderRadius: "0 4px 4px 0" }} />
            </div>

            {/* Endurance */}
            <div style={{ display: "flex" }}>
              <select name="toughness_op" value={searchParams.toughness_op} onChange={handleInputChange} style={{ width: 60, borderRadius: "4px 0 0 4px", borderRight: "none" }}>
                <option value="=">=</option><option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option><option value="<=">&le;</option>
              </select>
              <input type="text" name="toughness" placeholder="Endurance (ex: 4)" value={searchParams.toughness} onChange={handleInputChange} style={{ flex: 1, borderRadius: "0 4px 4px 0" }} />
            </div>

            {/* Légalité */}
            <div style={{ display: "flex", gap: 10 }}>
              <select name="format_legality" value={searchParams.format_legality} onChange={handleInputChange} style={{ flex: 1 }}>
                  <option value="">-- Format --</option>
                  <option value="standard">Standard</option>
                  <option value="modern">Modern</option>
                  <option value="commander">Commander</option>
                  <option value="vintage">Vintage</option>
                  <option value="pioneer">Pioneer</option>
              </select>
              <select name="is_legal" value={searchParams.is_legal} onChange={handleInputChange} style={{ flex: 1 }}>
                  <option value="">Statut</option>
                  <option value="true">Légal</option>
                  <option value="false">Interdit</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2 }}>
                  {loading ? "Recherche..." : "Rechercher"}
              </button>
              <button type="button" onClick={clearFilters} className="btn-danger" style={{ flex: 1 }}>
                  Effacer
              </button>
          </div>
          {error && <div style={{ color: "red", marginTop: 10, fontSize: "0.9rem" }}>{error}</div>}
        </form>
      </div>

      {/* --- BOUTON IMPORT FIXÉ EN BAS --- */}
      <div style={{ padding: "15px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-main)", borderRadius: "0 0 var(--radius) var(--radius)" }}>
        <button 
          className="btn-primary" 
          onClick={onImportClick} 
          style={{ width: "100%", padding: "12px", fontSize: "1rem", fontWeight: "bold", background: "#4CAF50", borderColor: "#4CAF50" }}
        >
          ➕ Importer des cartes
        </button>
        <p style={{ margin: "5px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
          (Depuis Arena, texte, etc.)
        </p>
      </div>

    </div>
  );
}