from fastapi import APIRouter, HTTPException, Depends, Request, Body
from database import user_cards_collection, cards_collection
from routes.auth_routes import get_current_user
from models.card import extract_card_fields
from bson import ObjectId
import httpx
import asyncio
import re
import logging
from typing import List, Dict

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("user_card_routes")

# Stockage mémoire progression
import_progress: Dict[str, dict] = {}

# --- UTILITAIRES ---

def parse_import_line(line: str):
    line = line.strip()
    if not line: return None
    # Regex Format: "2 Crystal Grotto (WOE) 254"
    match_full = re.match(r"^(\d+)\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s+(\d+[a-zA-Z]*)$", line)
    if match_full:
        return {
            "quantity": int(match_full.group(1)),
            "name": match_full.group(2).strip(),
            "set": match_full.group(3).lower(),
            "collector_number": match_full.group(4)
        }
    # Regex Format: "2 Crystal Grotto"
    match_simple = re.match(r"^(\d+)x?\s+(.*)$", line)
    if match_simple:
        return { "quantity": int(match_simple.group(1)), "name": match_simple.group(2).strip(), "set": None, "collector_number": None }
    
    return { "quantity": 1, "name": line, "set": None, "collector_number": None }

async def fetch_scryfall_batch(identifiers: List[dict]):
    url = "https://api.scryfall.com/cards/collection"
    found_cards = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        chunk_size = 75
        for i in range(0, len(identifiers), chunk_size):
            chunk = identifiers[i:i + chunk_size]
            try:
                resp = await client.post(url, json={"identifiers": chunk})
                if resp.status_code == 200:
                    data = resp.json()
                    found_cards.extend(data.get("data", []))
                
                # PAUSE CRITIQUE : Laisse le serveur respirer
                await asyncio.sleep(0.1) 
            except Exception as e:
                print(f"Erreur Scryfall Batch: {e}")
    return found_cards

async def perform_import(data: List, user_id: str):
    """Logique d'import optimisée et NON BLOQUANTE"""
    uid = str(user_id)
    try:
        import_progress[uid]["status"] = "processing"
        
        # 1. Parsing
        parsed_entries = []
        for entry in data:
            if isinstance(entry, dict):
                line_to_parse = f"{entry.get('quantity', 1)} {entry.get('name', '')}"
                parsed = parse_import_line(line_to_parse)
            else:
                parsed = parse_import_line(str(entry))
            
            if parsed: parsed_entries.append(parsed)

        total_entries = len(parsed_entries)
        import_progress[uid]["total"] = total_entries

        # 2. Préparation Scryfall
        identifiers_to_fetch = []
        quantity_map = {} 

        for p in parsed_entries:
            if p["set"] and p["collector_number"]:
                key = f"{p['set']}:{p['collector_number']}".lower()
                identifiers_to_fetch.append({"set": p["set"], "collector_number": p["collector_number"]})
            else:
                key = p["name"].lower()
                identifiers_to_fetch.append({"name": p["name"]})
            
            quantity_map[key] = quantity_map.get(key, 0) + p["quantity"]
            
        # Petite pause pour laisser passer les requêtes GET progress
        await asyncio.sleep(0.01)

        # 3. Appel Scryfall
        fetched_cards = []
        if identifiers_to_fetch:
            fetched_cards = await fetch_scryfall_batch(identifiers_to_fetch)

        # 4. Insertion DB (Mise à jour avec nouveaux champs V2)
        imported_count = 0
        
        for idx, scryfall_data in enumerate(fetched_cards):
            # PAUSE CRITIQUE : À chaque itération DB, on rend la main
            if idx % 5 == 0:
                await asyncio.sleep(0.02)

            cleaned = extract_card_fields(scryfall_data)
            card_id = cleaned.get("id")
            
            # Logique quantité
            set_code = str(scryfall_data.get("set", "")).lower()
            cn = str(scryfall_data.get("collector_number", "")).lower()
            name = str(scryfall_data.get("name", "")).lower()
            key_exact = f"{set_code}:{cn}"
            
            qty = 1
            if key_exact in quantity_map:
                qty = quantity_map[key_exact]
            elif name in quantity_map:
                qty = quantity_map[name]

            # A. Carte Globale
            if not cards_collection.find_one({"id": card_id}):
                cleaned["owners"] = [uid]
                cards_collection.insert_one(cleaned)
            else:
                cards_collection.update_one({"id": card_id}, {"$addToSet": {"owners": uid}})

            # B. Carte Utilisateur (Dénormalisation V2)
            existing = user_cards_collection.find_one({"user_id": uid, "card_id": card_id})
            if existing:
                user_cards_collection.update_one({"_id": existing["_id"]}, {"$inc": {"count": qty}})
            else:
                # ✅ INSÉRER TOUS LES NOUVEAUX CHAMPS ICI
                user_cards_collection.insert_one({
                    "user_id": uid,
                    "card_id": card_id,
                    "count": qty,
                    
                    # Infos essentielles
                    "name": cleaned.get("name"),
                    "lang": cleaned.get("lang"),
                    "oracle_id": cleaned.get("oracle_id"),
                    
                    # Edition
                    "set": cleaned.get("set"),
                    "set_name": cleaned.get("set_name"),
                    "collector_number": cleaned.get("collector_number"),
                    
                    # Visuel
                    "image_normal": cleaned.get("image_normal"),
                    "image_small": cleaned.get("image_small"),
                    
                    # Gameplay
                    "rarity": cleaned.get("rarity"),
                    "colors": cleaned.get("colors", []),
                    "type_line": cleaned.get("type_line", ""),
                    "oracle_text": cleaned.get("oracle_text", ""),
                    "keywords": cleaned.get("keywords", []),
                    "cmc": cleaned.get("cmc", 0),
                    "power": cleaned.get("power", ""),
                    "toughness": cleaned.get("toughness", ""),
                    "legalities": cleaned.get("legalities", {}),
                    
                    # Finance
                    "prices": cleaned.get("prices", {})
                })
            
            imported_count += 1
            
            # Mise à jour progression
            if imported_count % 2 == 0:
                import_progress[uid].update({"processed": imported_count, "imported": imported_count})

        import_progress[uid].update({"status": "completed", "processed": total_entries, "imported": imported_count})

    except Exception as e:
        import_progress[uid].update({"status": "error", "error": str(e)})
        print(f"Crash Import: {e}")

# --- ROUTES ---

@router.post("/usercards/import")
async def start_import(request: Request, user_id: str = Depends(get_current_user)):
    try:
        data = await request.json()
        uid = str(user_id)
        # Reset progress
        import_progress[uid] = {"total": len(data), "processed": 0, "imported": 0, "status": "starting"}
        asyncio.create_task(perform_import(data, uid))
        return {"message": "Import lancé", "total": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usercards/import/progress")
async def get_progress(user_id: str = Depends(get_current_user)):
    uid = str(user_id)
    return import_progress.get(uid, {"status": "idle", "processed": 0, "total": 0})

@router.put("/usercards/{card_id}")
async def update_user_card_count(card_id: str, body: dict = Body(...), user_id: str = Depends(get_current_user)):
    try:
        uid = str(user_id)
        new_count = body.get("count")
        query = {"user_id": uid, "_id": ObjectId(card_id)} if ObjectId.is_valid(card_id) else {"user_id": uid, "card_id": card_id}
        
        if int(new_count) <= 0:
            user_cards_collection.delete_one(query)
            return {"message": "Supprimé"}
        
        res = user_cards_collection.update_one(query, {"$set": {"count": int(new_count)}})
        if res.matched_count == 0 and not ObjectId.is_valid(card_id):
             # Fallback inverse
             user_cards_collection.update_one({"user_id": uid, "card_id": card_id}, {"$set": {"count": int(new_count)}})
             
        return {"message": "OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/usercards")
async def add_user_card(request: Request, user_id: str = Depends(get_current_user)):
    try:
        uid = str(user_id)
        data = await request.json()
        card_id = data.get("id")
        if not card_id: raise HTTPException(status_code=400, detail="ID manquant")
        
        # On extrait les données propres (nécessaire pour l'insertion optimisée)
        cleaned = extract_card_fields(data)

        if not cards_collection.find_one({"id": card_id}):
            cards_collection.insert_one(cleaned)
            
        existing = user_cards_collection.find_one({"user_id": uid, "card_id": card_id})
        if existing:
            user_cards_collection.update_one({"_id": existing["_id"]}, {"$inc": {"count": 1}})
        else:
            # ✅ AJOUT DES DONNÉES DENORMALISÉES V2
            user_cards_collection.insert_one({
                "user_id": uid, 
                "card_id": card_id, 
                "count": 1,
                
                # Mêmes champs enrichis que pour l'import de masse
                "name": cleaned.get("name"), 
                "lang": cleaned.get("lang"),
                "oracle_id": cleaned.get("oracle_id"),
                "set": cleaned.get("set"),
                "set_name": cleaned.get("set_name"),
                "collector_number": cleaned.get("collector_number"),
                "image_normal": cleaned.get("image_normal"),
                "image_small": cleaned.get("image_small"),
                "rarity": cleaned.get("rarity"),
                "colors": cleaned.get("colors", []),
                "type_line": cleaned.get("type_line", ""),
                "oracle_text": cleaned.get("oracle_text", ""),
                "keywords": cleaned.get("keywords", []),
                "cmc": cleaned.get("cmc", 0),
                "power": cleaned.get("power", ""),
                "toughness": cleaned.get("toughness", ""),
                "legalities": cleaned.get("legalities", {}),
                "prices": cleaned.get("prices", {})
            })
        return {"message": "Ajouté"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))