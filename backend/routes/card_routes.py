from fastapi import APIRouter, HTTPException, Depends, Request
from database import cards_collection, user_cards_collection
from routes.auth_routes import get_current_user
from bson import ObjectId
from typing import List
from pydantic import BaseModel
import re

router = APIRouter()

# --- MODELES Pydantic ---
class CardBatchRequest(BaseModel):
    card_ids: List[str]

# --- ROUTES ---

# 1. RECUPERATION PAR LOT (Pour les Decks)
@router.post("/cards/batch")
async def get_cards_batch(payload: CardBatchRequest, user_id: str = Depends(get_current_user)):
    try:
        ids = payload.card_ids
        if not ids:
            return {"cards": []}

        cards_cursor = cards_collection.find({"id": {"$in": ids}})
        cards_map = {c["id"]: c for c in cards_cursor}

        user_entries = list(user_cards_collection.find({"user_id": user_id, "card_id": {"$in": ids}}))
        user_counts = {u["card_id"]: u["count"] for u in user_entries}

        result = []
        for cid in ids:
            card = cards_map.get(cid)
            if card:
                card["_id"] = str(card["_id"])
                card["owned_count"] = user_counts.get(card["id"], 0)
                result.append(card)
        
        unique_results = {c["id"]: c for c in result}.values()

        return {"cards": list(unique_results)}

    except Exception as e:
        print(f"Error batch cards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 2. RECHERCHE AVANCEE (Optimisée avec champs locaux)
@router.get("/cards/search")
async def search_user_cards(
    request: Request,
    user_id: str = Depends(get_current_user),
    name: str = None,
    rarity: str = None,
    colors: str = None,
    type_line: str = None,
    keywords: str = None,
    cmc: float = None,
    power: str = None,
    toughness: str = None,
    format_legality: str = None,
    sort_by: str = "name",
    page: int = 1,
    limit: int = 200
):
    try:
        # ETAPE 1 : Filtrage sur la collection User (Rapide)
        pipeline = [
            {"$match": {"user_id": user_id}}
        ]

        match_filters = {}

        # 1. Nom
        if name:
            match_filters["name"] = {"$regex": re.escape(name), "$options": "i"}

        # 2. Rareté
        if rarity:
            match_filters["rarity"] = rarity

        # 3. Couleurs (Logique stricte)
        if colors:
            raw_colors = [c.strip() for c in colors.split(",")]
            if "C" in raw_colors:
                match_filters["colors"] = {"$size": 0}
            else:
                # Cette syntaxe dit : 
                # 1. Contient TOUTES ces couleurs ($all)
                # 2. La taille est exactement celle demandée ($size)
                # C'est la seule façon fiable de faire une égalité stricte de tableau en MongoDB
                match_filters["$and"] = [
                    {"colors": {"$all": raw_colors}},
                    {"colors": {"$size": len(raw_colors)}}
                ]

        # 4. Types (Inclusion / Exclusion)
        if type_line:
            types = [t.strip() for t in type_line.split(",") if t.strip()]
            type_conditions = []
            for t in types:
                if t.startswith("-"):
                    clean_type = t[1:].strip()
                    if clean_type:
                        # "ne contient pas ce type"
                        type_conditions.append({"type_line": {"$not": {"$regex": re.escape(clean_type), "$options": "i"}}})
                else:
                    # "contient ce type"
                    type_conditions.append({"type_line": {"$regex": re.escape(t), "$options": "i"}})
            
            if type_conditions:
                if "$and" not in match_filters:
                    match_filters["$and"] = []
                match_filters["$and"].extend(type_conditions)

        # 5. Autres filtres
        if keywords:
            match_filters["keywords"] = {"$regex": re.escape(keywords), "$options": "i"}
        if cmc is not None:
            match_filters["cmc"] = float(cmc)
        if power:
            match_filters["power"] = power
        if toughness:
            match_filters["toughness"] = toughness
        if format_legality:
            match_filters[f"legalities.{format_legality}"] = {"$in": ["legal", "restricted"]}

        # Application des filtres
        if match_filters:
            pipeline.append({"$match": match_filters})

        # ETAPE 2 : Pagination et Tri
        skip = (page - 1) * limit
        sort_field = "name" if sort_by == "name" else sort_by

        pipeline.append({
            "$facet": {
                "metadata": [{"$count": "total"}],
                "data": [
                    {"$sort": {sort_field: 1}},
                    {"$skip": skip},
                    {"$limit": limit},
                    # ETAPE 3 : Join pour récupérer l'image et infos manquantes
                    {
                        "$lookup": {
                            "from": "Cards",
                            "localField": "card_id",
                            "foreignField": "id",
                            "as": "details"
                        }
                    },
                    {"$unwind": "$details"},
                    {
                        "$project": {
                            "_id": 1,
                            "count": 1,
                            "name": 1, # On prend le nom local
                            "rarity": 1, # On prend la rareté locale
                            "colors": 1,
                            # On complète avec les détails globaux si besoin d'images
                            "image_normal": "$details.image_normal",
                            "set_name": "$details.set_name",
                            "id": "$details.id",
                        }
                    }
                ]
            }
        })

        result = list(user_cards_collection.aggregate(pipeline))
        
        data = result[0]["data"]
        total = result[0]["metadata"][0]["total"] if result[0]["metadata"] else 0

        for c in data:
            c["_id"] = str(c["_id"])

        return {"cards": data, "total": total}

    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. ROUTE PAR DEFAUT
@router.get("/cards")
async def get_all_cards(user_id: str = Depends(get_current_user)):
    return await search_user_cards(Request, user_id, page=1, limit=200)

# 4. GET SINGLE CARD
@router.get("/cards/{card_id}")
async def get_single_card(card_id: str, user_id: str = Depends(get_current_user)):
    try:
        query = {"_id": ObjectId(card_id)} if ObjectId.is_valid(card_id) else {"id": card_id}
        card = cards_collection.find_one(query)
        if not card: raise HTTPException(status_code=404, detail="Carte non trouvée")
        uc = user_cards_collection.find_one({"user_id": user_id, "card_id": card["id"]})
        card["_id"] = str(card["_id"])
        card["count"] = uc["count"] if uc else 0
        card["owned"] = uc is not None
        return card
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. DELETE CARD
@router.delete("/cards/{card_id}")
async def delete_card(card_id: str, user_id: str = Depends(get_current_user)):
    try:
        target_id = card_id
        if ObjectId.is_valid(card_id):
            c = cards_collection.find_one({"_id": ObjectId(card_id)})
            if c: target_id = c.get("id")
        res = user_cards_collection.delete_one({"user_id": user_id, "card_id": target_id})
        cards_collection.update_one({"id": target_id}, {"$pull": {"owners": user_id}})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Introuvable")
        return {"message": "Supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. UPDATE MULTIFACES
@router.post("/cards/update-multifaces")
async def update_multiface_cards(user_id: str = Depends(get_current_user)):
    return {"message": "Non implémenté"}