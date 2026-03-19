from fastapi import APIRouter, HTTPException, Response, Request, Body, Depends
from bson import ObjectId
import secrets
import httpx
from datetime import datetime
from utils.passwords import hash_password, verify_password
from database import users_collection, user_cards_collection, cards_collection, items_collection, history_collection
from models.card import extract_card_fields

router = APIRouter()

sessions = {}

async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non connecte")

    user_id = sessions.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expiree ou invalide")

    return user_id

@router.post("/register")
def register_user(data: dict = Body(...)):
    nom = data.get("nom")
    email = data.get("email")
    password = data.get("password")

    if not nom or not email or not password:
        raise HTTPException(status_code=400, detail="Tous les champs sont obligatoires")

    if len(nom) > 32:
        raise HTTPException(status_code=400, detail="Le nom d'utilisateur ne peut pas depasser 32 caracteres")
    email = email.strip().lower()

    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cette adresse email est deja enregistree")

    hashed_password = hash_password(password)

    result = users_collection.insert_one({
        "nom": nom.strip(),
        "email": email,
        "password": hashed_password,
        "avatar": None 
    })

    return {"message": "Utilisateur cree avec succes", "id": str(result.inserted_id)}

@router.post("/login")
def login_user(response: Response, data: dict = Body(...)):
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email et mot de passe sont requis")
    email = email.strip().lower()

    user = users_collection.find_one({"email": email})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    token = secrets.token_hex(16)
    sessions[token] = str(user["_id"]) 

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False, 
    )

    return {"message": "Connexion reussie", "user": {"id": str(user["_id"]), "nom": user["nom"], "avatar": user.get("avatar")}}

@router.post("/logout")
def logout_user(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token and token in sessions:
        del sessions[token]
    response.delete_cookie("session_token")
    return {"message": "Deconnexion reussie"}

@router.get("/me")
def get_me(request: Request):
    token = request.cookies.get("session_token")
    user_id = sessions.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Non connecte")

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    return {
        "id": str(user["_id"]), 
        "nom": user["nom"], 
        "email": user["email"],
        "avatar": user.get("avatar") 
    }

@router.get("/proxy-image")
async def proxy_image(url: str):
    if not url.startswith("https://cards.scryfall.io/"):
        raise HTTPException(status_code=400, detail="URL non autorisee")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Image introuvable sur Scryfall")
        
        return Response(content=resp.content, media_type=resp.headers.get("content-type", "image/jpeg"))

@router.put("/me/nom")
async def update_nom(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    new_nom = data.get("nom", "").strip()
    
    if not new_nom:
        raise HTTPException(status_code=400, detail="Le pseudo ne peut pas etre vide")
    if len(new_nom) > 32:
        raise HTTPException(status_code=400, detail="Le pseudo est trop long (32 caracteres max)")

    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"nom": new_nom}})
    return {"message": "Pseudo mis a jour", "nom": new_nom}

@router.put("/me/avatar")
async def update_avatar(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    new_avatar = data.get("avatar")
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"avatar": new_avatar}})
    return {"message": "Avatar mis a jour", "avatar": new_avatar}

@router.put("/me/email")
async def update_email(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    new_email = data.get("new_email", "").strip().lower()
    password = data.get("password")

    if not new_email or not password:
        raise HTTPException(status_code=400, detail="Champs manquants")

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")

    if users_collection.find_one({"email": new_email, "_id": {"$ne": ObjectId(user_id)}}):
        raise HTTPException(status_code=400, detail="Cette adresse email est deja utilisee")

    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"email": new_email}})
    return {"message": "Adresse email mise a jour"}

@router.put("/me/password")
async def update_password(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Champs manquants")

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not verify_password(old_password, user["password"]):
        raise HTTPException(status_code=401, detail="Ancien mot de passe incorrect")

    hashed_pw = hash_password(new_password)
    users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"password": hashed_pw}})
    return {"message": "Mot de passe mis a jour"}

@router.get("/me/collection/ids")
async def get_my_collection_ids(user_id: str = Depends(get_current_user)):
    user_cards = list(user_cards_collection.find({"user_id": user_id}, {"card_id": 1}))
    if not user_cards:
        return {"ids": []}
        
    unique_card_ids = list(set([str(c["card_id"]) for c in user_cards if "card_id" in c]))
    return {"ids": unique_card_ids}

@router.post("/me/collection/update/chunk")
async def update_my_collection_chunk(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    chunk = data.get("ids", [])
    if not chunk:
        return {"updated": 0}
        
    identifiers = [{"id": cid} for cid in chunk]
    updated_count = 0
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post("https://api.scryfall.com/cards/collection", json={"identifiers": identifiers})
            if resp.status_code == 200:
                scryfall_data = resp.json().get("data", [])
                for scryfall_card in scryfall_data:
                    cleaned = extract_card_fields(scryfall_card)
                    card_id = cleaned["id"]
                    
                    cards_collection.update_one(
                        {"id": card_id},
                        {"$set": cleaned}
                    )
                    updated_count += 1
        except Exception as e:
            print(f"Erreur API Scryfall chunk: {e}")
            raise HTTPException(status_code=500, detail="Erreur API Scryfall")
            
    return {"updated": updated_count}

@router.post("/me/collection/update/log")
async def log_collection_update(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    processed = data.get("processed", 0)
    history_collection.insert_one({
        "user_id": user_id,
        "type": "COLLECTION_UPDATE",
        "date": datetime.utcnow(),
        "details": f"Mise a jour generale des donnees de la collection ({processed} cartes).",
        "status": "success",
        "cards": []
    })
    return {"message": "Historique enregistre."}

@router.delete("/me/collection")
async def delete_my_collection(user_id: str = Depends(get_current_user)):
    result = user_cards_collection.delete_many({"user_id": user_id})
    return {"message": f"Collection videe. {result.deleted_count} cartes supprimees."}

@router.delete("/me")
async def delete_account(request: Request, response: Response, user_id: str = Depends(get_current_user)):
    user_cards_collection.delete_many({"user_id": user_id})
    items_collection.delete_many({"user_id": user_id})
    history_collection.delete_many({"user_id": user_id})
    users_collection.delete_one({"_id": ObjectId(user_id)})

    token = request.cookies.get("session_token")
    if token and token in sessions:
        del sessions[token]
    response.delete_cookie("session_token")

    return {"message": "Compte et donnees supprimes avec succes."}