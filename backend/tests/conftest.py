import pytest
import os
from pymongo import MongoClient
from fastapi.testclient import TestClient

# --- CONFIGURATION ENVIRONNEMENT ---
os.environ["MONGO_DB_NAME"] = "All_scans_TEST"

# Important : faire les imports APRES avoir set la variable d'env
from main import app
from routes.auth_routes import get_current_user

TEST_USER_ID = "test_user_12345"

@pytest.fixture(scope="session", autouse=True)
def clean_db_after_tests():
    """Supprime la BDD de test à la toute fin."""
    yield
    client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    client.drop_database("All_scans_TEST")
    print("\n🗑️  Base de données de test 'All_scans_TEST' supprimée.")

@pytest.fixture
def client():
    """
    Client de test avec nettoyage automatique AVANT chaque test.
    """
    # 1. Connexion à la base de test
    mongo = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    db = mongo["All_scans_TEST"]
    
    # 2. NETTOYAGE COMPLET (C'est ici qu'on ajoute Users)
    db.Items.delete_many({})
    db.UserCards.delete_many({})
    db.Cards.delete_many({})
    db.Users.delete_many({}) # <--- LIGNE AJOUTÉE CRUCIALE
    
    # 3. Override de l'auth par défaut (pour les tests standards)
    def override_get_current_user():
        return TEST_USER_ID
    
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as c:
        yield c
    
    # 4. Nettoyage après
    app.dependency_overrides = {}