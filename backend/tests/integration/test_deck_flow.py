import pytest
from database import items_collection, cards_collection
from bson import ObjectId

# --- DONNÉES DE TEST (3 Cartes différentes) ---
MOCK_CARDS = [
    {
        "id": "card-dragon-001",
        "name": "Shivan Dragon",
        "image_normal": "http://fake.img/dragon.jpg",
        "type_line": "Creature — Dragon",
        "mana_cost": "{4}{R}{R}",
        "cmc": 6,
        "colors": ["R"],
    },
    {
        "id": "card-land-002",
        "name": "Forest",
        "image_normal": "http://fake.img/forest.jpg",
        "type_line": "Basic Land — Forest",
        "mana_cost": "",
        "cmc": 0,
        "colors": [],
    },
    {
        "id": "card-spell-003",
        "name": "Counterspell",
        "image_normal": "http://fake.img/counter.jpg",
        "type_line": "Instant",
        "mana_cost": "{U}{U}",
        "cmc": 2,
        "colors": ["U"],
    }
]

def test_advanced_deck_flow(client):
    """
    Scénario d'intégration complet :
    1. Setup : Injection de 3 cartes différentes en BDD.
    2. Création : On crée un deck Commander.
    3. Ajout Multiple : On ajoute 1 Dragon, 1 Sort, et 2 Terrains (test de quantité).
    4. Vérification Enrichissement : On vérifie que le GET renvoie les bonnes images/coûts.
    5. Vérification Quantité : On vérifie que Forest a bien une quantité de 2.
    6. Suppression Partielle : On retire 1 Forest -> doit passer à 1.
    7. Suppression Totale : On retire le Dragon -> doit disparaître.
    """

    # --- 1. SETUP (Injection des cartes globales) ---
    for card in MOCK_CARDS:
        cards_collection.update_one(
            {"id": card["id"]}, 
            {"$set": card}, 
            upsert=True
        )

    # --- 2. CRÉATION DU DECK ---
    deck_res = client.post("/items", json={
        "nom": "Deck Integration Test",
        "type": "deck",
        "format": "commander"
    })
    assert deck_res.status_code == 200
    deck_id = deck_res.json()["id"]

    # --- 3. AJOUT DES CARTES (1 Dragon, 1 Sort, 2 Forêts) ---
    # Ajout Dragon
    client.post(f"/items/{deck_id}/add_card", json={"card_id": "card-dragon-001"})
    # Ajout Sort
    client.post(f"/items/{deck_id}/add_card", json={"card_id": "card-spell-003"})
    # Ajout Forêt (2 fois pour tester l'incrémentation)
    client.post(f"/items/{deck_id}/add_card", json={"card_id": "card-land-002"})
    client.post(f"/items/{deck_id}/add_card", json={"card_id": "card-land-002"})

    # --- 4. VÉRIFICATION DU CONTENU (GET Details) ---
    res_get = client.get(f"/items/{deck_id}")
    assert res_get.status_code == 200
    data = res_get.json()

    # Vérification générale
    assert data["nom"] == "Deck Integration Test"
    assert len(data["cards"]) == 3 # Dragon, Sort, Forêt (les doublons sont regroupés)

    # Helper pour trouver une carte spécifique dans la réponse
    def find_card(card_id):
        return next((c for c in data["cards"] if c["card_id"] == card_id), None)

    # TEST A : Vérification des données enrichies (Dragon)
    dragon = find_card("card-dragon-001")
    assert dragon is not None
    assert dragon["name"] == "Shivan Dragon"
    assert dragon["image_normal"] == "http://fake.img/dragon.jpg" # L'image vient bien de la collection Cards
    assert dragon["mana_cost"] == "{4}{R}{R}"
    assert dragon["quantity"] == 1

    # TEST B : Vérification des quantités (Forêt)
    forest = find_card("card-land-002")
    assert forest is not None
    assert forest["quantity"] == 2 # On l'a ajouté 2 fois, le backend doit dire 2

    # --- 5. TEST DE SUPPRESSION PARTIELLE ---
    # On retire une Forêt (il en reste 2 actuellement)
    res_remove_land = client.post(f"/items/{deck_id}/remove_card", json={"card_id": "card-land-002"})
    assert res_remove_land.status_code == 200

    # On vérifie
    data_after_remove = client.get(f"/items/{deck_id}").json()
    new_forest = next(c for c in data_after_remove["cards"] if c["card_id"] == "card-land-002")
    assert new_forest["quantity"] == 1 # 2 - 1 = 1

    # --- 6. TEST DE SUPPRESSION TOTALE ---
    # On retire le Dragon (il y en a 1)
    client.post(f"/items/{deck_id}/remove_card", json={"card_id": "card-dragon-001"})

    # On vérifie
    data_final = client.get(f"/items/{deck_id}").json()
    
    # Le dragon ne doit plus être dans la liste
    missing_dragon = next((c for c in data_final["cards"] if c["card_id"] == "card-dragon-001"), None)
    assert missing_dragon is None
    
    # Il doit rester le Sort (1) et la Forêt (1)
    assert len(data_final["cards"]) == 2