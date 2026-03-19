# routes/card_routes.py
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from database import cards_collection, user_cards_collection
from models.card import extract_card_fields
from routes.auth_routes import get_current_user
from bson import ObjectId
from typing import List, Optional
from pydantic import BaseModel
import re
import httpx


router = APIRouter()

class CardBatchRequest(BaseModel):
    card_ids: List[str]

def build_comparison_query(value: str, operator: str):
    try:
        numeric_value = float(value)
        is_numeric = True
    except ValueError:
        numeric_value = value
        is_numeric = False

    mongo_ops = {
        "=": "$eq",
        ">": "$gt",
        ">=": "$gte",
        "<": "$lt",
        "<=": "$lte",
        "!=": "$ne"
    }
    
    op_code = mongo_ops.get(operator, "$eq")
    
    if not is_numeric and operator in [">", ">=", "<", "<="]:
        return value

    return {op_code: numeric_value}

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

@router.get("/cards/search")
async def search_user_cards(
    request: Request,
    user_id: str = Depends(get_current_user),
    name: Optional[str] = None,
    rarity: Optional[str] = None,
    colors: Optional[str] = None,
    color_mode: str = Query("exact", description="exact ou subset"),
    type_line: Optional[str] = None,
    keywords: Optional[str] = None,
    cmc: Optional[float] = None,
    oracle_text: Optional[str] = None,
    power: Optional[str] = None,
    power_op: str = "=",
    toughness: Optional[str] = None,
    toughness_op: str = "=",
    format_legality: Optional[str] = None,
    is_legal: Optional[bool] = None,
    sort_by: str = "name",
    page: int = 1,
    limit: int = 200
):
    try:
        pipeline = [{"$match": {"user_id": user_id}}]
        match_filters = {}

        if name:
            match_filters["name"] = {"$regex": re.escape(name), "$options": "i"}

        if oracle_text:
            match_filters["oracle_text"] = {"$regex": re.escape(oracle_text), "$options": "i"}

        if rarity:
            match_filters["rarity"] = rarity

        if colors:
            raw_colors = [c.strip() for c in colors.split(",")]
            if "C" in raw_colors:
                match_filters["colors"] = {"$size": 0}
            else:
                if color_mode == "exact":
                    match_filters["$and"] = [
                        {"colors": {"$all": raw_colors}},
                        {"colors": {"$size": len(raw_colors)}}
                    ]
                else: 
                    match_filters["colors"] = {
                        "$not": {"$elemMatch": {"$nin": raw_colors}},
                        "$ne": []
                    }

        if type_line:
            types = [t.strip() for t in type_line.split(",") if t.strip()]
            type_conditions = []
            for t in types:
                if t.startswith("-"):
                    clean_type = t[1:].strip()
                    if clean_type:
                        type_conditions.append({"type_line": {"$not": {"$regex": re.escape(clean_type), "$options": "i"}}})
                else:
                    type_conditions.append({"type_line": {"$regex": re.escape(t), "$options": "i"}})
            
            if type_conditions:
                if "$and" not in match_filters:
                    match_filters["$and"] = []
                match_filters["$and"].extend(type_conditions)

        if keywords:
            match_filters["keywords"] = {"$regex": re.escape(keywords), "$options": "i"}
        
        if cmc is not None:
            match_filters["cmc"] = float(cmc)

        if power is not None:
            match_filters["power"] = build_comparison_query(power, power_op)
        
        if toughness is not None:
            match_filters["toughness"] = build_comparison_query(toughness, toughness_op)

        if format_legality:
            field_path = f"legalities.{format_legality.lower()}"
            if is_legal is True:
                match_filters[field_path] = {"$in": ["legal", "restricted"]}
            elif is_legal is False:
                match_filters[field_path] = {"$in": ["not_legal", "banned"]}
            else:
                match_filters[field_path] = {"$in": ["legal", "restricted"]}

        if match_filters:
            pipeline.append({"$match": match_filters})

        skip = (page - 1) * limit
        sort_field = "name" if sort_by == "name" else sort_by

        pipeline.append({
            "$facet": {
                "metadata": [{"$count": "total"}],
                "data": [
                    {"$sort": {sort_field: 1}},
                    {"$skip": skip},
                    {"$limit": limit},
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
                            "is_foil": 1, # AJOUT MAJEUR : Le frontend peut desormais voir si la carte est Foil
                            "name": 1,
                            "rarity": 1,
                            "colors": 1,
                            "oracle_text": 1,
                            "power": 1,
                            "toughness": 1,
                            "image_normal": "$details.image_normal",
                            "image_art_crop": "$details.image_art_crop", # Ajout pour preparer l'avatar utilisateur !
                            "set_name": "$details.set_name",
                            "id": "$details.id"
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

@router.get("/cards")
async def get_all_cards(user_id: str = Depends(get_current_user)):
    return await search_user_cards(Request, user_id=user_id, page=1, limit=200)

@router.get("/cards/{card_id}")
async def get_single_card(card_id: str, is_foil: Optional[bool] = None, user_id: str = Depends(get_current_user)):
    try:
        query = {"_id": ObjectId(card_id)} if ObjectId.is_valid(card_id) else {"id": card_id}
        card = cards_collection.find_one(query)
        
        # --- FALLBACK SCRYFALL SECURISE ---
        if not card and not ObjectId.is_valid(card_id):
            try:
                # Scryfall bloque souvent si on ne met pas de User-Agent
                headers = {"User-Agent": "MyMTGApp/1.0", "Accept": "application/json"}
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(f"https://api.scryfall.com/cards/{card_id}", headers=headers)
                    if resp.status_code == 200:
                        cleaned = extract_card_fields(resp.json())
                        cards_collection.insert_one(cleaned)
                        card = cleaned
                    else:
                        raise HTTPException(status_code=404, detail=f"Non trouve sur Scryfall (Code: {resp.status_code})")
            except Exception as fallback_err:
                print(f"Erreur de telechargement Scryfall: {fallback_err}")
                raise HTTPException(status_code=500, detail=f"Erreur de telechargement depuis Scryfall: {str(fallback_err)}")

        if not card:
            raise HTTPException(status_code=404, detail="Carte non trouvee dans la base")
        
        uc_query = {"user_id": user_id, "card_id": card["id"]}
        if is_foil is not None:
            uc_query["is_foil"] = is_foil

        uc = user_cards_collection.find_one(uc_query)
        
        if "_id" in card:
            card["_id"] = str(card["_id"])
            
        card["count"] = uc["count"] if uc else 0
        card["owned"] = uc is not None
        card["is_foil"] = uc["is_foil"] if uc and "is_foil" in uc else (is_foil or False)
        
        return card
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cards/{card_id}")
async def delete_card(card_id: str, is_foil: Optional[bool] = None, user_id: str = Depends(get_current_user)):
    try:
        target_id = card_id
        if ObjectId.is_valid(card_id):
            c = cards_collection.find_one({"_id": ObjectId(card_id)})
            if c:
                target_id = c.get("id")
        
        uc_query = {"user_id": user_id, "card_id": target_id}
        if is_foil is not None:
            uc_query["is_foil"] = is_foil

        res = user_cards_collection.delete_one(uc_query)
        
        # Nettoyage global uniquement si l'utilisateur ne possede plus AUCUNE version de la carte
        remaining = user_cards_collection.count_documents({"user_id": user_id, "card_id": target_id})
        if remaining == 0:
            cards_collection.update_one({"id": target_id}, {"$pull": {"owners": user_id}})
        
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Introuvable")
        return {"message": "Supprime"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cards/update-multifaces")
async def update_multiface_cards(user_id: str = Depends(get_current_user)):
    return {"message": "Non implemente"}