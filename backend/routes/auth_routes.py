from fastapi import APIRouter, HTTPException, Response, Request, Body
from bson import ObjectId
import secrets
from utils.passwords import hash_password, verify_password

router = APIRouter()

# On importe la collection directement depuis notre fichier centralisé
from database import users_collection
# Sessions en mémoire (clé = token, valeur = user_id)
sessions = {}


async def get_current_user(request: Request):
    token = request.cookies.get("session_token")    
    print("🔍 Cookie reçu côté backend :", token)
    if not token:
        print("❌ Aucun cookie de session trouvé dans la requête.")
        raise HTTPException(status_code=401, detail="Non connecté")

    user_id = sessions.get(token)
    if not user_id:
        print("❌ Token invalide ou expiré :", token)
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")

    print(f"✅ Session valide pour utilisateur {user_id}")
    return user_id



@router.post("/register")
def register_user(data: dict = Body(...)):
    nom = data.get("nom")
    email = data.get("email")
    password = data.get("password")

    if not nom or not email or not password:
        raise HTTPException(status_code=400, detail="Tous les champs sont obligatoires")

    if len(nom) > 32:
        raise HTTPException(status_code=400, detail="Le nom d'utilisateur ne peut pas dépasser 32 caractères")
    email = email.strip().lower()

    # ✅ Vérification de l’unicité de l’email
    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cette adresse email est déjà enregistrée")

    # ✅ Hash du mot de passe
    hashed_password = hash_password(password)

    # ✅ Insertion dans la base
    result = users_collection.insert_one({
        "nom": nom.strip(),
        "email": email,
        "password": hashed_password,
    })

    return {"message": "Utilisateur créé avec succès", "id": str(result.inserted_id)}


@router.post("/login")
def login_user(response: Response, data: dict = Body(...)):
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email et mot de passe sont requis")
    email = email.strip().lower()

    # ✅ Recherche de l’utilisateur
    user = users_collection.find_one({"email": email})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    # ✅ Création du token de session
    token = secrets.token_hex(16)
    sessions[token] = str(user["_id"])  # Associe le token à l’utilisateur

    # ✅ Création du cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # ⚠️ Mettre True en production
    )
    print(f"✅ Connexion réussie pour {user['email']} avec token {token}")

    return {"message": "Connexion réussie", "user": {"id": str(user["_id"]), "nom": user["nom"]}}


@router.post("/logout")
def logout_user(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token and token in sessions:
        del sessions[token]
    response.delete_cookie("session_token")
    return {"message": "Déconnexion réussie"}


@router.get("/me")
def get_me(request: Request):
    token = request.cookies.get("session_token")
    user_id = sessions.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Non connecté")

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    return {"id": str(user["_id"]), "nom": user["nom"], "email": user["email"]}
