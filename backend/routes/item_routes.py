from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pymongo import MongoClient
from bson import ObjectId
from routes.auth_routes import get_current_user
from database import items_collection, user_cards_collection, cards_collection
from collections import Counter 

router = APIRouter(prefix="/items", tags=["items"])

# 1. Créer un élément
@router.post("")
async def create_item(request: Request, user_id: str = Depends(get_current_user)):
    data = await request.json()
    nom = data.get("nom")
    type_ = data.get("type", "folder")
    parent_id = data.get("parent_id")
    image = data.get("image")
    format_ = data.get("format", "standard")

    if not nom:
        raise HTTPException(status_code=400, detail="Nom requis")
        
    if type_ not in ["folder", "deck"]:
        raise HTTPException(status_code=400, detail="Type invalide")

    new_item = {
        "user_id": user_id,
        "type": type_,
        "nom": nom,
        "parent_id": parent_id,
        "image": image,
        "cards": [], 
    }
    
    if type_ == "deck":
        new_item["format"] = format_

    result = items_collection.insert_one(new_item)
    return {"message": f"{type_.capitalize()} créé", "id": str(result.inserted_id)}


# 2. Récupérer la liste (Racine ou Dossier)
@router.get("")
def get_items(parent_id: str | None = None, user_id: str = Depends(get_current_user)):
    query = {"user_id": user_id, "parent_id": parent_id}
    items = list(items_collection.find(query))
    for item in items:
        item["id"] = str(item["_id"])
        del item["_id"]
    return {"items": items}


# ✅ 3. (DÉPLACÉ ICI) Récupérer tous les decks pour la liste déroulante
# IMPERATIF : Doit être AVANT /{item_id}
@router.get("/all_lists_and_decks")
def get_all_lists_and_decks(user_id: str = Depends(get_current_user)):
    items = list(items_collection.find({"user_id": user_id, "type": "deck"}))
    for item in items:
        item["id"] = str(item["_id"])
        del item["_id"]
    return {"items": items}


# 4. Récupérer un ITEM UNIQUE (Générique)
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
                        "cmc": details.get("cmc", 0)
                    })
            
            item["cards"] = enriched_cards

        item["id"] = str(item["_id"])
        del item["_id"]
        
        return item

    except Exception as e:
        print(f"Erreur Get Item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 5. Mettre à jour un item
@router.put("/{item_id}")
def update_item(
    item_id: str,
    data: dict = Body(...),
    user_id: str = Depends(get_current_user)
):
    update_fields = {}
    if "nom" in data: update_fields["nom"] = data["nom"]
    if "format" in data: update_fields["format"] = data["format"]
    if "image" in data: update_fields["image"] = data["image"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="Aucune donnée à modifier")

    result = items_collection.update_one(
        {"_id": ObjectId(item_id), "user_id": user_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item non trouvé")
        
    return {"message": "Mise à jour effectuée"}


# 6. Ajouter une carte (CORRIGÉ pour gérer ID Mongo vs Scryfall)
@router.post("/{item_id}/add_card")
async def add_card_to_item(
    item_id: str,
    data: dict = Body(...),
    user_id: str = Depends(get_current_user)
):
    card_id_received = data.get("card_id")
    
    if not card_id_received:
        raise HTTPException(status_code=400, detail="Aucun ID fourni")

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item non trouvé")
    if item["type"] != "deck":
        raise HTTPException(status_code=400, detail="Ce n'est pas un deck")

    # Résolution ID
    target_scryfall_id = card_id_received
    if ObjectId.is_valid(card_id_received):
        user_card = user_cards_collection.find_one({"_id": ObjectId(card_id_received)})
        if user_card:
            target_scryfall_id = user_card.get("card_id")
        else:
            global_card = cards_collection.find_one({"_id": ObjectId(card_id_received)})
            if global_card:
                target_scryfall_id = global_card.get("id")

    items_collection.update_one(
        {"_id": ObjectId(item_id)},
        {"$push": {"cards": target_scryfall_id}}
    )

    return {"message": "Carte ajoutée", "added_id": target_scryfall_id}


# 7. Retirer une carte
@router.post("/{item_id}/remove_card")
async def remove_card_from_item(
    item_id: str,
    data: dict = Body(...),
    user_id: str = Depends(get_current_user)
):
    card_id = data.get("card_id")
    
    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item non trouvé")

    current_cards = item.get("cards", [])
    
    if card_id in current_cards:
        current_cards.remove(card_id) 
        items_collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"cards": current_cards}}
        )
        return {"message": "Carte retirée"}
    else:
        raise HTTPException(status_code=404, detail="Carte non présente")


# 8. Supprimer un élément
@router.delete("/{item_id}")
def delete_item(item_id: str, user_id: str = Depends(get_current_user)):
    result = items_collection.delete_one({"_id": ObjectId(item_id), "user_id": user_id})
    if result.deleted_count == 1:
        return {"message": "Élément supprimé"}
    raise HTTPException(status_code=404, detail="Élément non trouvé")


# 9. Dupliquer un deck
@router.post("/{item_id}/duplicate")
def duplicate_item(
    item_id: str,
    data: dict = Body(...),
    user_id: str = Depends(get_current_user)
):
    new_name = data.get("new_name", "Copie sans nom")
    original = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not original:
        raise HTTPException(status_code=404, detail="Item original non trouvé")

    new_item = {
        "user_id": user_id,
        "type": original["type"],
        "nom": new_name,
        "parent_id": original.get("parent_id"),
        "image": original.get("image"),
        "cards": original.get("cards", []),
        "format": original.get("format", "standard")
    }

    result = items_collection.insert_one(new_item)
    return {"message": "Copie créée", "new_id": str(result.inserted_id)}