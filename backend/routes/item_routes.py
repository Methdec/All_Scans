from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pymongo import MongoClient
from bson import ObjectId
from routes.auth_routes import get_current_user
from database import items_collection, user_cards_collection, cards_collection
from collections import Counter 
import math
import re
import httpx
from models.card import extract_card_fields

router = APIRouter(prefix="/items", tags=["items"])

# --- CONFIGURATION (Toujours utile pour le fallback et l'analyse) ---
BASIC_LAND_NAMES = {
    "W": "Plains", 
    "U": "Island", 
    "B": "Swamp", 
    "R": "Mountain", 
    "G": "Forest",
    "C": "Wastes" # Ajout pour l'incolore si besoin
}

# IDs de secours (au cas où l'user n'a RIEN dans sa collection)
# J'ai mis des IDs d'images très standards (Set ONE ou MOM) qui sont stables
FALLBACK_LAND_IDS = {
    "Plains": "22990926-3701-4470-a363-229202a0a202",
    "Island": "03473a21-9923-4e4b-972c-f60447092497",
    "Swamp": "6c434934-2977-4409-9fc6-948677026772",
    "Mountain": "787c800b-3375-4428-a640-62432824d772",
    "Forest": "59b434cb-9c09-4d64-9279-373307b66782",
    "Wastes": "9cc070d3-4b83-4684-9caf-063d4c47c8bb"
}

async def ensure_card_exists_in_db(card_id: str):
    """S'assure qu'une carte existe dans la collection globale pour l'affichage"""
    if not cards_collection.find_one({"id": card_id}):
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"https://api.scryfall.com/cards/{card_id}")
                if resp.status_code == 200:
                    from models.card import extract_card_fields
                    cleaned = extract_card_fields(resp.json())
                    cards_collection.insert_one(cleaned)
            except Exception as e:
                print(f"⚠️ Erreur fallback download {card_id}: {e}")

# ==========================================
# 1. DOSSIERS & LISTES
# ==========================================

@router.get("/folders/all")
def get_all_folders(user_id: str = Depends(get_current_user)):
    """Récupère tous les dossiers pour les listes déroulantes"""
    folders = list(items_collection.find({"user_id": user_id, "type": "folder"}))
    for f in folders:
        f["id"] = str(f["_id"])
        del f["_id"]
    return {"folders": folders}

@router.get("/all_lists_and_decks")
def get_all_lists_and_decks(user_id: str = Depends(get_current_user)):
    items = list(items_collection.find({"user_id": user_id, "type": "deck"}))
    for item in items:
        item["id"] = str(item["_id"])
        del item["_id"]
    return {"items": items}

# ==========================================
# 2. CRUD ITEMS (CREATE, GET, UPDATE, DELETE)
# ==========================================

@router.post("")
async def create_item(request: Request, user_id: str = Depends(get_current_user)):
    data = await request.json()
    nom = data.get("nom")
    type_ = data.get("type", "folder")
    parent_id = data.get("parent_id")
    image = data.get("image")
    format_ = data.get("format", "standard")

    if not nom: raise HTTPException(status_code=400, detail="Nom requis")
    if type_ not in ["folder", "deck"]: raise HTTPException(status_code=400, detail="Type invalide")

    new_item = {
        "user_id": user_id, "type": type_, "nom": nom, "parent_id": parent_id,
        "image": image, "cards": []
    }
    if type_ == "deck": new_item["format"] = format_

    result = items_collection.insert_one(new_item)
    return {"message": f"{type_.capitalize()} créé", "id": str(result.inserted_id)}

@router.get("")
def get_items(parent_id: str | None = None, user_id: str = Depends(get_current_user)):
    query = {"user_id": user_id, "parent_id": parent_id}
    items = list(items_collection.find(query))
    for item in items:
        item["id"] = str(item["_id"])
        del item["_id"]
    return {"items": items}

@router.get("/{item_id}")
async def get_item_details(item_id: str, user_id: str = Depends(get_current_user)):
    try:
        if not ObjectId.is_valid(item_id):
            raise HTTPException(status_code=400, detail="ID Invalide")
            
        # A. On cherche l'item
        item = items_collection.find_one({
            "_id": ObjectId(item_id), 
            "user_id": user_id
        })
        
        if not item:
            raise HTTPException(status_code=404, detail="Introuvable")

        # B. Enrichissement des données du deck
        if item.get("type") == "deck" and item.get("cards"):
            card_counts = Counter(item["cards"])
            unique_ids = list(card_counts.keys())
            
            global_cards = list(cards_collection.find({"id": {"$in": unique_ids}}))
            cards_map = {c["id"]: c for c in global_cards}
            
            enriched_cards = []
            
            for card_id, qty in card_counts.items():
                details = cards_map.get(card_id)
                if details:
                    enriched_cards.append({
                        "card_id": card_id,
                        "quantity": qty,
                        "name": details.get("name"),
                        "image_normal": details.get("image_normal"),
                        "mana_cost": details.get("mana_cost", ""), 
                        "type_line": details.get("type_line", ""),
                        "colors": details.get("colors", []),
                        "cmc": details.get("cmc", 0),
                        # --- AJOUT ICI ---
                        "set_name": details.get("set_name", details.get("set", "???").upper()) 
                    })
                
            item["cards"] = enriched_cards

        item["id"] = str(item["_id"])
        del item["_id"]
        
        return item

    except Exception as e:
        print(f"Erreur Get Item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{item_id}")
def update_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    update_fields = {}
    if "nom" in data: update_fields["nom"] = data["nom"]
    if "format" in data: update_fields["format"] = data["format"]
    if "image" in data: update_fields["image"] = data["image"]
    if "parent_id" in data: update_fields["parent_id"] = data["parent_id"]
    
    # ✅ AJOUTE CETTE LIGNE :
    if "is_constructed" in data: update_fields["is_constructed"] = data["is_constructed"]

    if not update_fields: raise HTTPException(status_code=400, detail="Aucune donnée à modifier")

    result = items_collection.update_one({"_id": ObjectId(item_id), "user_id": user_id}, {"$set": update_fields})
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Item non trouvé")
    return {"message": "Mise à jour effectuée"}

@router.delete("/{item_id}")
def delete_item(item_id: str, user_id: str = Depends(get_current_user)):
    result = items_collection.delete_one({"_id": ObjectId(item_id), "user_id": user_id})
    if result.deleted_count == 1: return {"message": "Élément supprimé"}
    raise HTTPException(status_code=404, detail="Élément non trouvé")

# ==========================================
# 3. GESTION DES CARTES DANS LE DECK
# ==========================================

@router.post("/{item_id}/add_card")
async def add_card_to_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    card_id_received = data.get("card_id")
    if not card_id_received: raise HTTPException(status_code=400, detail="Aucun ID fourni")

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item: raise HTTPException(status_code=404, detail="Item non trouvé")
    if item["type"] != "deck": raise HTTPException(status_code=400, detail="Ce n'est pas un deck")

    # 1. Résolution de l'ID Scryfall et récupération de l'image
    target_scryfall_id = card_id_received
    card_image = None

    if ObjectId.is_valid(card_id_received):
        # Cas 1 : ID MongoDB (UserCard)
        user_card = user_cards_collection.find_one({"_id": ObjectId(card_id_received)})
        if user_card:
            target_scryfall_id = user_card.get("card_id")
            card_image = user_card.get("image_normal")
        else:
            # Cas 2 : ID MongoDB (GlobalCard - peu probable ici mais possible)
            global_card = cards_collection.find_one({"_id": ObjectId(card_id_received)})
            if global_card:
                target_scryfall_id = global_card.get("id")
                card_image = global_card.get("image_normal")
    else:
        # Cas 3 : ID Scryfall direct
        global_card = cards_collection.find_one({"id": card_id_received})
        if global_card:
            card_image = global_card.get("image_normal")

    # 2. Préparation de la mise à jour
    # On ajoute toujours la carte
    update_query = {"$push": {"cards": target_scryfall_id}}
    
    # 3. Logique "Première Image"
    # Si le deck n'a pas d'image ET qu'on a trouvé une image pour cette carte
    if not item.get("image") and card_image:
        update_query["$set"] = {"image": card_image}

    items_collection.update_one({"_id": ObjectId(item_id)}, update_query)
    
    return {"message": "Carte ajoutée", "added_id": target_scryfall_id}

@router.post("/{item_id}/remove_card")
async def remove_card_from_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    card_id = data.get("card_id")
    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item: raise HTTPException(status_code=404, detail="Item non trouvé")

    current_cards = item.get("cards", [])
    if card_id in current_cards:
        current_cards.remove(card_id) 
        items_collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"cards": current_cards}})
        return {"message": "Carte retirée"}
    else:
        raise HTTPException(status_code=404, detail="Carte non présente")

# ==========================================
# 4. DUPLICATION
# ==========================================

@router.post("/{item_id}/duplicate")
def duplicate_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    original = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not original:
        raise HTTPException(status_code=404, detail="Item original non trouvé")

    new_name = data.get("new_name", f"Copie - {original['nom']}")
    target_parent_id = data.get("parent_id", original.get("parent_id"))

    new_item = {
        "user_id": user_id,
        "type": original["type"],
        "nom": new_name,
        "parent_id": target_parent_id,
        "image": original.get("image"),
        "cards": original.get("cards", []),
        "format": original.get("format", "standard")
    }

    result = items_collection.insert_one(new_item)
    return {"message": "Copie créée", "new_id": str(result.inserted_id)}

# ==========================================
# 5. AUTO-BALANCE LANDS (VERSION FICTIVE/INFINIE)
# ==========================================

@router.post("/{item_id}/auto_balance_lands")
async def auto_balance_lands(item_id: str, user_id: str = Depends(get_current_user)):
    try:
        # 1. Chargement du Deck
        if not ObjectId.is_valid(item_id): raise HTTPException(status_code=400, detail="ID Invalide")
        deck = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
        if not deck or deck.get("type") != "deck": raise HTTPException(status_code=404, detail="Deck introuvable")

        current_card_ids = deck.get("cards", [])
        
        # 2. Analyse des cartes (Pips & Terrains actuels)
        unique_ids = list(set(current_card_ids))
        global_cards = list(cards_collection.find({"id": {"$in": unique_ids}}))
        cards_map = {c["id"]: c for c in global_cards}

        pips = {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0, "C": 0}
        non_basic_count = 0
        total_pips = 0
        
        final_deck_list = current_card_ids.copy()

        for card_id in current_card_ids:
            details = cards_map.get(card_id)
            if not details: continue

            type_line = details.get("type_line", "")
            name = details.get("name", "")
            
            # On considère basique tout ce qui a le nom exact d'un terrain de base
            is_basic = name in BASIC_LAND_NAMES.values()
            
            if "Land" in type_line:
                if not is_basic: non_basic_count += 1
                continue 

            mana_cost = details.get("mana_cost", "")
            
            # Analyse simple des couleurs (ex: {2}{U}{U})
            for color_code in ["W", "U", "B", "R", "G", "C"]:
                c = mana_cost.count("{" + color_code + "}")
                if c > 0:
                    pips[color_code] += c
                    total_pips += c

        # 3. Calculs Cibles
        target_total = 36 if deck.get("format", "").lower() == "commander" else 24
        slots_for_basics = target_total - non_basic_count

        if slots_for_basics <= 0:
            return {"message": "Pas de place pour des terrains basiques.", "logs": []}
        
        if total_pips == 0:
             return {"message": "Aucun symbole de couleur détecté.", "logs": []}

        logs = []
        
        # 4. Traitement par couleur
        for color, pips_count in pips.items():
            if pips_count == 0: continue

            land_name = BASIC_LAND_NAMES.get(color)
            if not land_name: continue

            ideal_count = round((pips_count / total_pips) * slots_for_basics)
            
            # Compter combien de CE terrain spécifique on a déjà dans le deck
            # (Attention : on peut avoir des Mountain d'éditions différentes, on les compte toutes)
            current_ids_in_deck = [
                cid for cid in final_deck_list 
                if cards_map.get(cid, {}).get("name") == land_name
            ]
            current_count = len(current_ids_in_deck)
            
            diff = ideal_count - current_count

            if diff < 0:
                # --- RETRAIT (Trop de terrains) ---
                to_remove = abs(diff)
                logs.append(f"- {to_remove} {land_name}")
                removed = 0
                
                # On retire en priorité les terrains qu'on vient de trouver
                # Pour être propre, on retire les IDs du deck
                for cid in list(final_deck_list):
                    if removed >= to_remove: break
                    if cards_map.get(cid, {}).get("name") == land_name:
                        final_deck_list.remove(cid)
                        removed += 1

            elif diff > 0:
                # --- AJOUT (Pas assez) ---
                to_add = diff
                logs.append(f"+ {to_add} {land_name}")
                
                # RECHERCHE COLLECTION UTILISATEUR
                # On cherche toutes les cartes que l'user possède avec ce nom exact
                candidates = list(user_cards_collection.find({
                    "user_id": user_id, 
                    "name": land_name
                }))
                
                added_count = 0
                
                # On itère sur les versions possédées
                for cand in candidates:
                    if added_count >= to_add: break
                    
                    cand_id = cand["card_id"]
                    qty_owned = cand.get("count", 0)
                    
                    # Combien sont déjà utilisées dans le deck AVANT cet ajout ?
                    already_in_deck = final_deck_list.count(cand_id)
                    
                    # Disponible pour ajout
                    available = qty_owned - already_in_deck
                    
                    if available > 0:
                        qty_to_take = min(to_add - added_count, available)
                        final_deck_list.extend([cand_id] * qty_to_take)
                        added_count += qty_to_take
                
                # FALLBACK : Si la collection ne suffit pas, on utilise la carte générique
                remaining = to_add - added_count
                if remaining > 0:
                    fallback_id = FALLBACK_LAND_IDS.get(land_name)
                    if fallback_id:
                        await ensure_card_exists_in_db(fallback_id)
                        final_deck_list.extend([fallback_id] * remaining)
                        logs.append(f"  (⚠️ {remaining} ajoutés depuis le stock infini)")

        # 5. Sauvegarde
        items_collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"cards": final_deck_list}}
        )

        return {
            "message": "Deck équilibré avec succès",
            "logs": logs,
            "new_count": len(final_deck_list)
        }

    except Exception as e:
        print(f"Erreur Auto Balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 6. UTILITAIRE DE NAVIGATION (Nouveau)
# ==========================================

@router.get("/path/{item_id}")
def get_item_hierarchy(item_id: str, user_id: str = Depends(get_current_user)):
    """Récupère le fil d'ariane complet (Ancêtres) pour un item donné"""
    try:
        path = []
        current_id = item_id
        
        # On remonte la chaîne des parents jusqu'à la racine (None)
        # Limite de sécurité à 20 niveaux pour éviter les boucles infinies
        for _ in range(20): 
            if not current_id or not ObjectId.is_valid(current_id):
                break
                
            item = items_collection.find_one(
                {"_id": ObjectId(current_id)}, 
                {"nom": 1, "parent_id": 1} # On ne récupère que le nécessaire
            )
            
            if not item:
                break
                
            # On insère au début de la liste pour avoir l'ordre [Grand-Père, Père, Fils]
            path.insert(0, {"id": str(item["_id"]), "name": item["nom"]})
            current_id = item.get("parent_id")
            
        return {"path": path}

    except Exception as e:
        print(f"Erreur Path: {e}")
        return {"path": []}