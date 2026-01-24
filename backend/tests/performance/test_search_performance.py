import pytest
import time
from database import user_cards_collection
from bson import ObjectId

# Configuration
NUM_CARDS_TO_SIMULATE = 2000
MAX_ALLOWED_TIME_SECONDS = 0.200  # 200ms max

def generate_fake_cards(count):
    """Génère une liste de fausses cartes pour peupler la DB."""
    cards = []
    for i in range(count):
        # On alterne les couleurs et les types pour simuler de la variété
        color = ["R"] if i % 3 == 0 else (["U"] if i % 3 == 1 else ["G"])
        type_line = "Creature — Goblin" if i % 2 == 0 else "Instant"
        
        cards.append({
            "user_id": "test_user_12345", # Doit correspondre au user du conftest
            "card_id": f"fake-card-{i}",
            "name": f"Card Number {i}",
            "colors": color,
            "type_line": type_line,
            "rarity": "common",
            "cmc": i % 5,
            "count": 1
        })
    return cards

def test_search_speed_large_collection(client):
    """
    Test de charge :
    1. On remplit la base avec 2000 cartes.
    2. On lance une recherche filtrée.
    3. On vérifie que ça prend moins de 200ms.
    """
    
    # 1. PEUPLEMENT DE LA BASE (Batch Insert)
    print(f"\n⚡ Génération et insertion de {NUM_CARDS_TO_SIMULATE} cartes...")
    fake_data = generate_fake_cards(NUM_CARDS_TO_SIMULATE)
    
    start_insert = time.perf_counter()
    user_cards_collection.insert_many(fake_data)
    end_insert = time.perf_counter()
    print(f"   -> Insertion terminée en {end_insert - start_insert:.4f}s")

    # 2. MESURE DE LA RECHERCHE
    # Scénario : L'utilisateur cherche "Goblin" de couleur "Rouge"
    search_params = {
        "user_id": "test_user_12345",
        "colors": "R",
        "type_line": "Goblin",
        "page": 1,
        "limit": 50
    }

    print("⏱️  Lancement de la recherche...")
    start_search = time.perf_counter()
    
    response = client.get("/cards/search", params=search_params)
    
    end_search = time.perf_counter()
    duration = end_search - start_search

    # 3. ANALYSE DES RÉSULTATS
    assert response.status_code == 200
    data = response.json()
    
    print(f"   -> Résultats trouvés : {data.get('total', 0)}")
    print(f"   -> Temps de réponse : {duration:.4f}s")

    # 4. ASSERTION DE PERFORMANCE
    assert duration < MAX_ALLOWED_TIME_SECONDS, \
        f"ALERTE : La recherche est trop lente ! ({duration:.4f}s > {MAX_ALLOWED_TIME_SECONDS}s)"