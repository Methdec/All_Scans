import { useState } from "react";
import "../App.css";
import CardGrid from "./CardGrid";
import CardSearchDetailModal from "./CardSearchDetailModal";

function CardSearchBar() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("fuzzy"); // "fuzzy" ou "exact"
  const [filters, setFilters] = useState({
    colors: "",
    color_identity: "",
    keywords: "",
    type: "",
    set_name: "",
    cmc: "",
    power: "",
    toughness: "",
    rarity: "",
    legality: "",
    legalityType: "legal",
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // ✅ Pagination (suivant / précédent)
  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [pageHistory, setPageHistory] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);
    setNextPageUrl(null);
    setPageHistory([]);
    setPageNumber(1);

    // Si le mode est "exact", utiliser l'endpoint /named de Scryfall
    if (searchMode === "exact") {
      if (!query.trim()) {
        setError("Veuillez saisir le nom exact de la carte.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(query)}`
        );
        const data = await res.json();

        if (data.object === "error") {
          setError(`Carte non trouvée : "${query}"`);
          setResults([]);
        } else {
          setResults([data]); // Retourner un tableau avec une seule carte
          setNextPageUrl(null);
        }
      } catch (err) {
        setError("Erreur lors de la recherche exacte.");
      }
      setLoading(false);
      return;
    }

    // Mode "fuzzy" (recherche avancée avec filtres)
    let searchParts = [];
    if (query) searchParts.push(query);
    if (filters.colors) searchParts.push(`color=${filters.colors}`);
    if (filters.color_identity) searchParts.push(`id=${filters.color_identity}`);
    if (filters.keywords) searchParts.push(`keyword:${filters.keywords}`);
    if (filters.type) searchParts.push(`type:${filters.type}`);
    if (filters.set_name) searchParts.push(`set:${filters.set_name}`);
    if (filters.cmc) searchParts.push(`cmc=${filters.cmc}`);
    if (filters.power) searchParts.push(`power=${filters.power}`);
    if (filters.toughness) searchParts.push(`toughness=${filters.toughness}`);
    if (filters.rarity) searchParts.push(`rarity:${filters.rarity}`);
    if (filters.legality) {
      const prefix = filters.legalityType === "not" ? "not" : "legal";
      searchParts.push(`${prefix}:${filters.legality}`);
    }

    const finalQuery = searchParts.join(" ");

    // ✅ Vérifie que la requête n'est pas vide
    if (!finalQuery.trim()) {
      setError("Veuillez saisir un nom ou un filtre avant de lancer la recherche.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}`
      );
      const data = await res.json();

      if (data.object === "error") {
        // ✅ Message personnalisé si aucun résultat trouvé
        if (data.details.includes("didn't match any cards")) {
          setError("Aucun résultat trouvé pour cette recherche.");
        } else {
          setError(data.details);
        }
      } else {
        setResults(data.data || []);
        setNextPageUrl(data.next_page || null);
      }
    } catch (err) {
      setError("Erreur lors de la recherche.");
    }

    setLoading(false);
  };

  const handleNextPage = async () => {
    if (!nextPageUrl) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(nextPageUrl);
      const data = await res.json();

      if (data.object === "error") {
        setError(data.details);
      } else {
        // ✅ Ajoute la page actuelle à l'historique
        setPageHistory((prev) => [...prev, nextPageUrl]);
        setResults(data.data || []);
        setNextPageUrl(data.has_more ? data.next_page : null);
        setPageNumber((n) => n + 1);
      }
    } catch (err) {
      setError("Erreur lors du chargement de la page suivante.");
    }

    setLoading(false);
  };

  const handlePrevPage = async () => {
    if (pageHistory.length === 0) return;
    setLoading(true);
    setError("");

    try {
      const prevUrl = pageHistory[pageHistory.length - 2];
      const res = await fetch(prevUrl);
      const data = await res.json();

      if (data.object === "error") {
        setError(data.details);
      } else {
        setResults(data.data || []);
        setNextPageUrl(data.next_page || null);
        setPageHistory((prev) => prev.slice(0, -1));
        setPageNumber((n) => Math.max(1, n - 1));
      }
    } catch (err) {
      setError("Erreur lors du chargement de la page précédente.");
    }

    setLoading(false);
  };

  const handleAddToCollection = async (card) => {
    // 🧹 On construit un objet filtré et propre
    // Pour les cartes multi-faces, image_uris peut être dans card_faces[0]
    const imageSmall = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null;
    const imageNormal = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null;
    
    const payload = {
      id: card.id,
      name: card.name,
      lang: card.lang,
      image_small: imageSmall,
      image_normal: imageNormal,
      card_faces: card.card_faces || null,  // Ajouter les faces pour les cartes multi-faces
      mana_cost: card.mana_cost || "",
      cmc: card.cmc || 0,
      type_line: card.type_line || "",
      oracle_text: card.oracle_text || "",
      power: card.power || null,
      toughness: card.toughness || null,
      colors: card.colors || [],
      color_identity: card.color_identity || [],
      keywords: card.keywords || [],
      rarity: card.rarity || "",
      artist: card.artist || "",
      set_name: card.set_name || "",
      full_art: card.full_art || false,
      promo: card.promo || false,
      prices: card.prices || {},
    };

    try {
      const res = await fetch("http://localhost:8000/usercards", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur serveur");
      }

      alert(`✅ ${card.name} ajoutée à votre collection !`);
    } catch (err) {
      console.error("Erreur ajout carte :", err);
      throw err;
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="toggle-advanced-btn"
      >
        {showAdvanced ? "Masquer les filtres avancés" : "Afficher les filtres avancés"}
      </button>

      <form onSubmit={handleSearch} className="card-search-form">
        <div className="filter-container">
          <label>Mode de recherche : </label>
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
            className="card-search-select"
          >
            <option value="fuzzy">Recherche fuzzy (avec filtres)</option>
            <option value="exact">Nom exact</option>
          </select>
        </div>

        <div className="filter-container">
          <label>Nom : </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchMode === "exact" ? "Nom exact de la carte..." : "Nom de la carte..."}
          />
        </div>

        {searchMode === "fuzzy" && (
          <>
            <div className="filter-container">
              <label>Couleur(s) : </label>
              <input
                type="text"
                name="colors"
                value={filters.colors}
                onChange={handleChange}
                placeholder="Couleurs (ex: WUGBR)"
              />
            </div>

            <div className="filter-container">
              <label>Rareté : </label>
              <select
                name="rarity"
                value={filters.rarity}
                onChange={handleChange}
                className="card-search-select"
              >
                <option value="">-- Sélectionner une rareté --</option>
                <option value="common">Commune</option>
                <option value="uncommon">Peu commune</option>
                <option value="rare">Rare</option>
                <option value="mythic">Mythique</option>
              </select>
            </div>
          </>
        )}

        {showAdvanced && searchMode === "fuzzy" && (
          <div className="advanced-filters">
            <div className="filter-container">
              <label>Identité de couleur : </label>
              <input
                type="text"
                name="color_identity"
                value={filters.color_identity}
                onChange={handleChange}
                placeholder="Color Identity (ex: WUGBR)"
              />
            </div>

            <div className="filter-container">
              <label>Mot(s) clé(s) : </label>
              <input
                type="text"
                name="keywords"
                value={filters.keywords}
                onChange={handleChange}
                placeholder="Mot-clé (ex: flying)"
              />
            </div>

            <div className="filter-container">
              <label>Type(s) : </label>
              <input
                type="text"
                name="type"
                value={filters.type}
                onChange={handleChange}
                placeholder="Type (ex: creature)"
              />
            </div>

            <div className="filter-container">
              <label>Nom du set : </label>
              <input
                type="text"
                name="set_name"
                value={filters.set_name}
                onChange={handleChange}
                placeholder="Édition (code, ex: khm)"
              />
            </div>

            <div className="filter-container">
              <label>Coût de mana converti : </label>
              <input
                type="number"
                name="cmc"
                value={filters.cmc}
                onChange={handleChange}
                placeholder="Coût converti (CMC)"
              />
            </div>

            <div className="filter-container">
              <label>Force : </label>
              <input
                type="text"
                name="power"
                value={filters.power}
                onChange={handleChange}
                placeholder="Puissance (ex: 3)"
              />
            </div>

            <div className="filter-container">
              <label>Endurance : </label>
              <input
                type="text"
                name="toughness"
                value={filters.toughness}
                onChange={handleChange}
                placeholder="Endurance (ex: 4)"
              />
            </div>

            <div className="filter-container">
              <label>Légalité : </label>
              <select
                name="legality"
                value={filters.legality}
                onChange={handleChange}
                className="card-search-select"
              >
                <option value="">-- Sélectionner un mode de jeu --</option>
                <option value="standard">Standard</option>
                <option value="modern">Modern</option>
                <option value="commander">Commander</option>
                <option value="vintage">Vintage</option>
                <option value="pioneer">Pioneer</option>
                <option value="pauper">Pauper</option>
              </select>

              <select
                name="legalityType"
                value={filters.legalityType}
                onChange={handleChange}
                className="card-search-select"
              >
                <option value="legal">Légal</option>
                <option value="not">Non légal</option>
              </select>
            </div>
          </div>
        )}

        <button type="submit" className="delete-btn">
          Rechercher
        </button>
      </form>

      {loading && <p>Recherche en cours...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && results.length === 0 && (
        <p style={{ color: "gray", fontStyle: "italic" }}>
          Aucun résultat trouvé pour cette recherche.
        </p>
      )}

      <CardGrid
        cards={results}
        onCardClick={(cardId) => {
          const card = results.find(c => c.id === cardId);
          if (card) setSelectedCard(card);
        }}
        renderAction={null}
      />

      {selectedCard && (
        <CardSearchDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onAddToCollection={handleAddToCollection}
        />
      )}

      {/* ✅ Pagination */}
      {results.length > 0 && searchMode === "fuzzy" && (
        <div className="pagination-controls">
          <button onClick={handlePrevPage} disabled={pageNumber === 1}>
            ← Page précédente
          </button>
          <span>Page {pageNumber}</span>
          <button onClick={handleNextPage} disabled={!nextPageUrl}>
            Page suivante →
          </button>
        </div>
      )}
    </div>
  );
}

export default CardSearchBar;
