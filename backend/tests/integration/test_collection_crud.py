import pytest
from database import cards_collection

# Donnée fictive
MOCK_CARD = {
    "id": "crud-test-card-001",
    "name": "Goblin Tester",
    "image_normal": "http://img.fake/goblin.jpg",
    "set": "tst",
    "collector_number": "1"
}

def test_card_collection_lifecycle(client):
    """
    Cycle de vie d'une carte dans la collection utilisateur :
    1. Ajout (Create) -> Vérif quantité 1
    2. Modification (Update) -> Passer quantité à 4
    3. Lecture (Read) -> Vérifier via la recherche
    4. Suppression (Delete) -> Vérifier qu'elle n'est plus là
    """

    # Setup : On s'assure que la carte existe dans la base globale "Cards"
    # Sinon l'ajout user risque d'échouer ou d'être incomplet
    cards_collection.update_one(
        {"id": MOCK_CARD["id"]}, {"$set": MOCK_CARD}, upsert=True
    )

    card_id = MOCK_CARD["id"]

    # --- 1. CREATE (Ajout) ---
    # On ajoute la carte une première fois
    res_add = client.post("/usercards", json=MOCK_CARD)
    assert res_add.status_code == 200

    # On vérifie qu'elle est bien là (via route unitaire ou search)
    # Ici on utilise get single card pour vérifier
    res_get = client.get(f"/cards/{card_id}")
    assert res_get.status_code == 200
    assert res_get.json()["owned"] is True
    assert res_get.json()["count"] == 1

    # --- 2. UPDATE (Modification Quantité) ---
    # On met la quantité à 4
    res_update = client.put(f"/usercards/{card_id}", json={"count": 4})
    assert res_update.status_code == 200

    # Vérification
    res_check = client.get(f"/cards/{card_id}")
    assert res_check.json()["count"] == 4

    # --- 3. READ (Recherche) ---
    # On teste que la recherche la trouve bien avec le filtre "owned" implicite
    res_search = client.get("/cards/search", params={"name": "Goblin Tester"})
    assert res_search.status_code == 200
    data = res_search.json()
    # On doit trouver notre carte dans les résultats
    found = next((c for c in data["cards"] if c["id"] == card_id), None)
    assert found is not None
    assert found["count"] == 4

    # --- 4. DELETE (Suppression) ---
    # Supposons que passer le count à 0 supprime, ou utiliser DELETE
    res_delete = client.delete(f"/cards/{card_id}")
    assert res_delete.status_code == 200

    # Vérification finale : elle ne doit plus être "owned"
    res_final = client.get(f"/cards/{card_id}")
    assert res_final.json()["owned"] is False
    assert res_final.json()["count"] == 0