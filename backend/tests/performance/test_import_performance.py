import pytest
import time
import httpx
import asyncio
from urllib.parse import quote as url_quote

# On définit ici les données de test directement
TEST_CARDS = ["Black Lotus", "Sol Ring", "Giant Growth"]
IMPORT_TEXTS = [
    "4 Lightning Bolt",
    "1 Sheoldred, the Apocalypse (DMU) 107a",
    "20 Mountain"
]

@pytest.mark.asyncio
@pytest.mark.parametrize("card_name", TEST_CARDS)
async def test_scryfall_request_performance(card_name):
    """
    Mesure le temps de réponse de Scryfall.
    Note : On utilise un client HTTP interne pour ne pas dépendre du 'client' de l'app si non nécessaire.
    """
    start_time = time.time()
    async with httpx.AsyncClient() as client:
        try:
            q = url_quote(card_name, safe='')
            res = await client.get(f"https://api.scryfall.com/cards/named?exact={q}")
            if res.status_code != 200:
                res = await client.get(f"https://api.scryfall.com/cards/named?fuzzy={q}")
            
            assert res.status_code == 200, f"Scryfall error: {res.status_code}"
            
        except Exception as e:
            pytest.fail(f"Erreur requête: {e}")
            
    duration = time.time() - start_time
    print(f"   -> {card_name}: {duration:.4f}s")
    # On veut que ça réponde en moins de 2 secondes
    assert duration < 2.0

@pytest.mark.parametrize("raw_text", IMPORT_TEXTS)
def test_parsing_performance(raw_text):
    """
    Test la vitesse du parsing (Regex).
    C'est du CPU pur, ça doit être instantané.
    """
    # Importation locale pour éviter les problèmes circulaires
    from routes.user_card_routes import parse_import_line
    
    start_time = time.time()
    for _ in range(1000): # On le fait 1000 fois pour que ce soit mesurable
        parse_import_line(raw_text)
    duration = time.time() - start_time
    
    print(f"   -> 1000x '{raw_text}': {duration:.4f}s")
    assert duration < 0.1 # Doit être quasi immédiat

@pytest.mark.asyncio
async def test_concurrent_batch_performance():
    """Test de charge : 5 requêtes simultanées."""
    card_names = ["Opt", "Negate", "Shock", "Duress", "Forest"]
    
    start_time = time.time()
    async with httpx.AsyncClient() as client:
        tasks = []
        for name in card_names:
            q = url_quote(name, safe='')
            tasks.append(client.get(f"https://api.scryfall.com/cards/named?fuzzy={q}"))
        
        responses = await asyncio.gather(*tasks)
        
        for res in responses:
            assert res.status_code == 200

    duration = time.time() - start_time
    print(f"   -> Batch 5 cartes: {duration:.4f}s")
    assert duration < 2.0