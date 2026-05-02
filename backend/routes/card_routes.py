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
    tags: Optional[str] = None,
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
    sort_dir: int = 1,
    set_code: Optional[str] = None,
    page: int = 1,
    limit: int = 200
):
    try:
        initial_match = {"user_id": user_id}
        
        if tags:
            tags_list = [t.strip().lower() for t in tags.split(",") if t.strip()]
            included_tags = [t for t in tags_list if not t.startswith("-")]
            excluded_tags = [t[1:] for t in tags_list if t.startswith("-")]
            
            if included_tags:
                initial_match["tags"] = {"$all": included_tags}
                
            if excluded_tags:
                if "tags" in initial_match:
                    initial_match["tags"]["$nin"] = excluded_tags
                else:
                    initial_match["tags"] = {"$nin": excluded_tags}

            if set_code:
                initial_match["card_id"] = {"$regex": f"^{set_code.lower()}"}

        pipeline = [{"$match": initial_match}]
        
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

        if set_code:
            match_filters["set"] = set_code.lower()

        skip = (page - 1) * limit
        
        sort_dir_val = int(sort_dir) if int(sort_dir) in [1, -1] else 1
        sort_field_map = {
            "count": "count",
            "price": "prices.eur",
            "set": "set_name",
            "name": "name"
        }
        actual_sort_field = sort_field_map.get(sort_by, "name")

        # Construction dynamique du sous-pipeline data
        data_pipeline = [
            {
                "$lookup": {
                    "from": "Cards",
                    "localField": "card_id",
                    "foreignField": "id",
                    "as": "details"
                }
            },
            {"$unwind": "$details"},
            {"$replaceRoot": {"newRoot": {"$mergeObjects": ["$details", "$$ROOT"]}}}
        ]

        if match_filters:
            data_pipeline.append({"$match": match_filters})

        data_pipeline.extend([
            {"$sort": {actual_sort_field: sort_dir_val}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$project": {
                    "_id": 1,
                    "count": 1,
                    "is_foil": 1, 
                    "tags": 1, 
                    "name": "$details.name",
                    "rarity": "$details.rarity",
                    "colors": "$details.colors",
                    "oracle_text": "$details.oracle_text",
                    "power": "$details.power",
                    "toughness": "$details.toughness",
                    "image_normal": "$details.image_normal",
                    "image_art_crop": "$details.image_art_crop",
                    "set_name": "$details.set_name",
                    "set": "$details.set",
                    "prices": "$details.prices",
                    "id": "$details.id"
                }
            }
        ])

        pipeline.append({
            "$facet": {
                "metadata": [{"$count": "total"}],
                "data": data_pipeline
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
        card["tags"] = uc.get("tags", []) if uc else [] # NOUVEAU : Renvoie les tags dans la modale
        
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


@router.get("/cards/collection/sets")
async def get_collection_sets(sort_dir: int = -1, user_id: str = Depends(get_current_user)):
    
    # On s'assure que la direction est bien 1 ou -1
    s_dir = 1 if sort_dir == 1 else -1

    pipeline = [
        {"$match": {"user_id": user_id}},
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
            "$group": {
                "_id": "$details.set",
                "set_name": {"$first": "$details.set_name"},
                "released_at": {"$first": "$details.released_at"},
                "count": {"$sum": "$count"}
            }
        },
        # On trie d'abord par date, puis par ordre alphabetique en secours
        {"$sort": {"released_at": s_dir, "set_name": 1}}, 
        {
            "$project": {
                "_id": 0,
                "set_code": "$_id",
                "set_name": 1,
                "released_at": 1,
                "count": 1
            }
        }
    ]
    sets = list(user_cards_collection.aggregate(pipeline))
    return {"sets": sets}


@router.get("/cards/prints/{oracle_id}")
async def get_card_prints(oracle_id: str, user_id: str = Depends(get_current_user)):
    """Recupere toutes les impressions (reprints) d'une carte via son oracle_id depuis Scryfall."""
    try:
        url = f"https://api.scryfall.com/cards/search?order=released&q=oracle_id:{oracle_id}&unique=prints"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Impressions introuvables sur Scryfall.")
            
            data = resp.json().get("data", [])
            
            # On passe chaque impression dans ton modele d'extraction pour standardiser la donnee
            cleaned_prints = [extract_card_fields(c) for c in data]
            
            return {"prints": cleaned_prints}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cards/collection/tags_summary")
async def get_collection_tags_summary(sort_dir: int = 1, user_id: str = Depends(get_current_user)):
    """Récupère la liste des tags avec le nombre total de cartes pour chacun."""
    
    s_dir = 1 if sort_dir == 1 else -1

    pipeline = [
        {"$match": {"user_id": user_id}},
        # $unwind sépare le tableau : une carte avec 2 tags comptera dans les 2 groupes
        # preserveNullAndEmptyArrays permet de garder les cartes sans tags pour les regrouper
        {"$unwind": {"path": "$tags", "preserveNullAndEmptyArrays": True}},
        {
            "$group": {
                # Si le tag est nul ou vide, on le nomme "Sans tag"
                "_id": {"$ifNull": ["$tags", "Sans tag"]},
                "count": {"$sum": "$count"}
            }
        },
        {"$sort": {"_id": s_dir}},
        {
            "$project": {
                "_id": 0,
                "tag_name": "$_id",
                "count": 1
            }
        }
    ]
    
    tags_summary = list(user_cards_collection.aggregate(pipeline))
    return {"tags_summary": tags_summary}