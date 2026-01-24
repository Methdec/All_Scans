// src/components/CardDetails.js
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function CardDetails() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lists, setLists] = useState([]);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState("");

  // 🟢 Charger les infos de la carte
  useEffect(() => {
    const fetchCard = async () => {
      try {
        const res = await fetch(`http://localhost:8000/cards/${cardId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Carte non trouvée");
        const data = await res.json();
        setCard(data);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement de la carte");
      }
    };
    fetchCard();
  }, [cardId]);

  // 🟢 Charger les listes et decks depuis /items
  const fetchUserCollections = async () => {
    try {
      const res = await fetch("http://localhost:8000/items", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur lors du chargement des éléments");

      const data = await res.json();
      const allItems = data.items || [];

      // On sépare les listes et decks
      setLists(allItems.filter((i) => i.type === "list"));
      setDecks(allItems.filter((i) => i.type === "deck"));
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les listes et decks");
    }
  };

  // 🟢 Ajouter une carte à un élément (liste ou deck)
  const handleAddCard = async (itemId) => {
    try {
      const res = await fetch(`http://localhost:8000/items/${itemId}/add_card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ card_id: card.id }),
      });
      if (!res.ok) throw new Error("Erreur lors de l’ajout");

      alert("✅ Carte ajoutée avec succès !");
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l’ajout de la carte");
    }
  };

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!card) return <p>Chargement...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>{card.name}</h2>
      {(card.image_normal || card.image_border_crop) && (
        <img
          src={card.image_normal || card.image_border_crop}
          alt={card.name}
          style={{ width: "250px", borderRadius: "8px" }}
        />
      )}
      <p><strong>Rareté :</strong> {card.rarity}</p>
      <p><strong>Type :</strong> {card.type_line}</p>
      <p><strong>Set :</strong> {card.set_name}</p>
      <p><strong>Mana cost :</strong> {card.mana_cost}</p>

      <button
        onClick={() => {
          setShowAddModal(true);
          fetchUserCollections();
        }}
        style={{
          marginTop: "15px",
          padding: "8px 14px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        ➕ Ajouter à un deck ou une liste
      </button>

      {/* 🪟 Fenêtre modale */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              width: "400px",
            }}
          >
            <h3>Ajouter cette carte à :</h3>

            <h4>🗂️ Listes</h4>
            {lists.length > 0 ? (
              lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleAddCard(l.id)}
                  style={{ display: "block", marginBottom: "6px" }}
                >
                  {l.nom}
                </button>
              ))
            ) : (
              <p>Aucune liste trouvée</p>
            )}

            <h4>🧩 Decks</h4>
            {decks.length > 0 ? (
              decks.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleAddCard(d.id)}
                  style={{ display: "block", marginBottom: "6px" }}
                >
                  {d.nom}
                </button>
              ))
            ) : (
              <p>Aucun deck trouvé</p>
            )}

            <button
              onClick={() => setShowAddModal(false)}
              style={{
                marginTop: "15px",
                backgroundColor: "red",
                color: "white",
                padding: "6px 10px",
                border: "none",
                borderRadius: "6px",
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
