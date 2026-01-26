import pytest
from fastapi.testclient import TestClient
from main import app
from database import users_collection

# Le TestClient agit comme un navigateur : il garde les cookies en mémoire entre les requêtes
client = TestClient(app)

def test_register_and_login_flow():
    """
    Test complet : Inscription -> Connexion (Cookie) -> Accès Profil
    """
    email = "newplayer@example.com"
    password = "SecurePassword123!"
    nom = "NewPlayer"

    # 0. Nettoyage préventif
    users_collection.delete_many({"email": email})

    # --- 1. INSCRIPTION (REGISTER) ---
    # Ton backend attend: "nom", "email", "password"
    payload_register = {
        "email": email,
        "password": password,
        "nom": nom  # <--- C'était "username" avant, voici la correction !
    }
    
    res_register = client.post("/auth/register", json=payload_register)
    
    if res_register.status_code != 200:
        pytest.fail(f"❌ Erreur Inscription : {res_register.json()}")

    assert res_register.status_code == 200
    print("\n✅ Inscription réussie")
    
    # --- 2. CONNEXION (LOGIN) ---
    # Ton backend attend du JSON (Body), pas du form-data
    res_login = client.post("/auth/login", json={
        "email": email, 
        "password": password
    })
    
    if res_login.status_code != 200:
        pytest.fail(f"❌ Erreur Login : {res_login.json()}")

    # Vérification que le cookie a bien été défini par le serveur
    assert "session_token" in res_login.cookies
    print("✅ Login réussi et Cookie reçu")

    # --- 3. ACCÈS PROTÉGÉ (/ME) ---
    # Pas besoin de header "Authorization". 
    # Le TestClient renvoie automatiquement le cookie reçu à l'étape précédente.
    res_me = client.get("/auth/me")
    
    if res_me.status_code != 200:
        pytest.fail(f"❌ Erreur /me : {res_me.json()}")
    
    data = res_me.json()
    assert data["email"] == email
    assert data["nom"] == nom
    print("✅ Accès profil réussi via Cookie")

    # --- 4. DÉCONNEXION (LOGOUT) ---
    res_logout = client.post("/auth/logout")
    assert res_logout.status_code == 200
    
    # On vérifie qu'on ne peut plus accéder au profil
    res_me_after = client.get("/auth/me")
    assert res_me_after.status_code == 401
    print("✅ Déconnexion validée")