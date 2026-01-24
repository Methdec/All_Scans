import pytest
import os
from pymongo import MongoClient

# --- 1. CONFIGURATION AVANT IMPORT ---
# C'est CRUCIAL : on définit la variable AVANT d'importer 'main' ou 'database'
# Ainsi, quand l'application démarre pour le test, elle se connecte à "All_scans_TEST"
os.environ["MONGO_DB_NAME"] = "All_scans_TEST"

from main import app
from routes.auth_routes import get_current_user
from fastapi.testclient import TestClient

# ID utilisateur fictif pour les tests
TEST_USER_ID = "test_user_12345"

@pytest.fixture(scope="session", autouse=True)
def clean_db_after_tests():
    """
    Cette fonction s'exécute une seule fois à la fin de tous les tests.
    Elle supprime la base de données de test pour ne pas laisser de traces.
    """
    yield # Laisse les tests tourner
    
    # Nettoyage final
    client = MongoClient("mongodb://localhost:27017/")
    client.drop_database("All_scans_TEST")
    print("\nBase de données de test 'All_scans_TEST' supprimée.")

@pytest.fixture
def client():
    """
    Crée un client de test authentifié.
    À chaque fois qu'un test a besoin de 'client', on lui donne celui-ci.
    """
    # Override de l'authentification
    def override_get_current_user():
        return TEST_USER_ID

    app.dependency_overrides[get_current_user] = override_get_current_user
    
    # On vide les collections avant chaque test pour partir propre
    # (Optionnel mais recommandé pour éviter que le test A ne perturbe le test B)
    mongo = MongoClient("mongodb://localhost:27017/")
    db = mongo["All_scans_TEST"]
    db.Items.delete_many({})
    db.UserCards.delete_many({})
    db.Cards.delete_many({})

    with TestClient(app) as c:
        yield c
    
    # Reset des overrides après le test
    app.dependency_overrides = {}