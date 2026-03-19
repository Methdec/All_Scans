# routes/user_card_routes.py
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from database import user_cards_collection, cards_collection, history_collection
from routes.auth_routes import get_current_user
from models.card import extract_card_fields
from bson import ObjectId
from datetime import datetime
from typing import List, Dict
from fastapi.responses import PlainTextResponse, Response
from utils.import_parser import parse_mtg_line
import httpx
import asyncio
import logging
import csv
import io
import json

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("user_card_routes")

import_progress: Dict[str, dict] = {}

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
                elif resp.status_code == 404:
                    # Scryfall renvoie 404 si absolument toutes les cartes du lot sont introuvables
                    logger.warning("Scryfall 404: Aucune carte de ce lot n'a ete trouvee.")
                
                await asyncio.sleep(0.1) 
            except Exception as e:
                logger.error(f"Erreur Scryfall Batch: {e}")
    return found_cards

async def perform_import(data: List, user_id: str):
    uid = str(user_id)
    try:
        import_progress[uid]["status"] = "processing"
        
        parsed_entries = []
        for entry in data:
            if isinstance(entry, dict):
                line_to_parse = f"{entry.get('quantity', 1)} {entry.get('name', '')}"
                parsed = parse_mtg_line(line_to_parse)
            else:
                parsed = parse_mtg_line(str(entry))
            
            if parsed:
                parsed_entries.append(parsed)

        total_entries = len(parsed_entries)
        import_progress[uid]["total"] = total_entries

        identifiers_to_fetch = []
        quantity_map = {} 

        for p in parsed_entries:
            is_foil = p.get("is_foil", False)
            foil_suffix = "_foil" if is_foil else "_normal"
            
            if p["set"] and p["collector_number"]:
                key = f"{p['set']}:{p['collector_number']}{foil_suffix}".lower()
                identifiers_to_fetch.append({"set": p["set"], "collector_number": p["collector_number"]})
            else:
                key = f"{p['name']}{foil_suffix}".lower()
                identifiers_to_fetch.append({"name": p["name"]})
            
            if key in quantity_map:
                quantity_map[key]["quantity"] += p["qty"]
            else:
                quantity_map[key] = {"quantity": p["qty"], "name": p["name"], "is_foil": is_foil}
            
        await asyncio.sleep(0.01)

        fetched_cards = []
        if identifiers_to_fetch:
            fetched_cards = await fetch_scryfall_batch(identifiers_to_fetch)

        imported_count = 0
        cards_found = []
        cards_not_found = []
        
        for idx, scryfall_data in enumerate(fetched_cards):
            if idx % 5 == 0:
                await asyncio.sleep(0.02)

            cleaned = extract_card_fields(scryfall_data)
            card_id = cleaned.get("id")
            
            set_code = str(scryfall_data.get("set", "")).lower()
            cn = str(scryfall_data.get("collector_number", "")).lower()
            name = str(scryfall_data.get("name", "")).lower()
            
            if not cards_collection.find_one({"id": card_id}):
                cleaned["owners"] = [uid]
                cards_collection.insert_one(cleaned)
            else:
                cards_collection.update_one({"id": card_id}, {"$addToSet": {"owners": uid}})

            for is_foil_check in [True, False]:
                suffix = "_foil" if is_foil_check else "_normal"
                key_exact = f"{set_code}:{cn}{suffix}"
                key_name = f"{name}{suffix}"
                
                qty = 0
                display_name = cleaned.get("name")
                
                if key_exact in quantity_map:
                    qty = quantity_map[key_exact]["quantity"]
                    display_name = quantity_map[key_exact]["name"]
                    del quantity_map[key_exact]
                elif key_name in quantity_map:
                    qty = quantity_map[key_name]["quantity"]
                    display_name = quantity_map[key_name]["name"]
                    del quantity_map[key_name]
                    
                if qty > 0:
                    existing = user_cards_collection.find_one({
                        "user_id": uid, 
                        "card_id": card_id,
                        "is_foil": is_foil_check
                    })
                    
                    if existing:
                        user_cards_collection.update_one({"_id": existing["_id"]}, {"$inc": {"count": qty}})
                    else:
                        user_cards_collection.insert_one({
                            "user_id": uid,
                            "card_id": card_id,
                            "count": qty,
                            "is_foil": is_foil_check,
                            "name": cleaned.get("name"),
                            "lang": cleaned.get("lang"),
                            "oracle_id": cleaned.get("oracle_id"),
                            "set": cleaned.get("set"),
                            "set_name": cleaned.get("set_name"),
                            "collector_number": cleaned.get("collector_number"),
                            "image_normal": cleaned.get("image_normal"),
                            "image_art_crop": cleaned.get("image_art_crop"),
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
                            "prices": cleaned.get("prices", {}),
                            "purchase_uris": cleaned.get("purchase_uris", {})
                        })
                    
                    cards_found.append({
                        "id": str(card_id),
                        "name": f"{display_name} (Foil)" if is_foil_check else display_name,
                        "found": True,
                        "quantity": qty
                    })
                    
                    imported_count += 1
            
            if imported_count % 2 == 0:
                import_progress[uid].update({"processed": imported_count, "imported": imported_count})

        for key, info in quantity_map.items():
            is_foil_tag = " (Foil)" if info.get("is_foil") else ""
            cards_not_found.append({
                "id": "unknown", # Remplacement de None par une chaine securisee
                "name": f"{info['name']}{is_foil_tag}",
                "found": False,
                "quantity": info["quantity"]
            })

        total_found = len(cards_found)
        total_missing = len(cards_not_found)
        
        if total_missing == 0:
            status = "success"
        elif total_found > 0:
            status = "warning"
        else:
            status = "error"

        history_entry = {
            "user_id": uid,
            "type": "IMPORT",
            "date": datetime.utcnow(),
            "details": f"Importation terminee : {total_found} cartes trouvees, {total_missing} introuvables.",
            "status": status,
            "cards": cards_found + cards_not_found
        }
        
        history_collection.insert_one(history_entry)
        import_progress[uid].update({"status": "completed", "processed": total_entries, "imported": imported_count})

    except Exception as e:
        import_progress[uid].update({"status": "error", "error": str(e)})
        logger.error(f"Crash Import: {e}")

@router.post("/usercards/import")
async def start_import(request: Request, user_id: str = Depends(get_current_user)):
    try:
        data = await request.json()
        uid = str(user_id)
        import_progress[uid] = {"total": len(data), "processed": 0, "imported": 0, "status": "starting"}
        asyncio.create_task(perform_import(data, uid))
        return {"message": "Import lance", "total": len(data)}
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
        is_foil = body.get("is_foil", False)
        
        if ObjectId.is_valid(card_id):
            query = {"user_id": uid, "_id": ObjectId(card_id)}
        else:
            query = {"user_id": uid, "card_id": card_id, "is_foil": is_foil}
        
        if int(new_count) <= 0:
            user_cards_collection.delete_one(query)
            return {"message": "Supprime"}
        
        res = user_cards_collection.update_one(query, {"$set": {"count": int(new_count)}})
        
        if res.matched_count == 0 and not ObjectId.is_valid(card_id):
             user_cards_collection.update_one(
                 {"user_id": uid, "card_id": card_id, "is_foil": is_foil}, 
                 {"$set": {"count": int(new_count)}}
             )
             
        return {"message": "OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/usercards")
async def add_user_card(request: Request, user_id: str = Depends(get_current_user)):
    try:
        uid = str(user_id)
        data = await request.json()
        card_id = data.get("id")
        is_foil = data.get("is_foil", False)
        
        if not card_id:
            raise HTTPException(status_code=400, detail="ID manquant")
        
        cleaned = extract_card_fields(data)

        if not cards_collection.find_one({"id": card_id}):
            cards_collection.insert_one(cleaned)
            
        existing = user_cards_collection.find_one({
            "user_id": uid, 
            "card_id": card_id,
            "is_foil": is_foil
        })
        
        if existing:
            user_cards_collection.update_one({"_id": existing["_id"]}, {"$inc": {"count": 1}})
        else:
            user_cards_collection.insert_one({
                "user_id": uid, 
                "card_id": card_id, 
                "count": 1,
                "is_foil": is_foil,
                "name": cleaned.get("name"), 
                "lang": cleaned.get("lang"),
                "oracle_id": cleaned.get("oracle_id"),
                "set": cleaned.get("set"),
                "set_name": cleaned.get("set_name"),
                "collector_number": cleaned.get("collector_number"),
                "image_normal": cleaned.get("image_normal"),
                "image_art_crop": cleaned.get("image_art_crop"),
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
                "prices": cleaned.get("prices", {}),
                "purchase_uris": cleaned.get("purchase_uris", {})
            })
        return {"message": "Ajoute"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usercards/export")
async def export_user_collection(format: str = "txt", user_id: str = Depends(get_current_user)):
    try:
        uid = str(user_id)
        cursor = user_cards_collection.find({"user_id": uid})
        cards = list(cursor)
        
        if not cards:
            raise HTTPException(status_code=404, detail="Votre collection est vide.")
            
        total_cards = sum(c.get("count", 1) for c in cards)
        unique_cards = len(cards)

        content = ""
        media_type = ""
        filename = ""

        if format == "txt":
            lines = []
            for c in cards:
                foil_tag = " *F*" if c.get("is_foil") else ""
                lines.append(f"{c.get('count', 1)} {c.get('name')}{foil_tag}")
            content = "\n".join(lines)
            media_type = "text/plain"
            filename = "collection_export.txt"

        elif format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Count", "Name", "Set", "Collector Number", "Language", "Foil"])
            for c in cards:
                writer.writerow([
                    c.get("count", 1),
                    c.get("name"),
                    c.get("set", ""),
                    c.get("collector_number", ""),
                    c.get("lang", ""),
                    "Yes" if c.get("is_foil") else "No"
                ])
            content = output.getvalue()
            media_type = "text/csv"
            filename = "collection_export.csv"

        elif format == "mtgo" or format == "dek":
            lines = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
                '  <NetDeckID>0</NetDeckID>',
                '  <PreconstructedDeckID>0</PreconstructedDeckID>'
            ]
            for c in cards:
                lines.append(f'  <Cards CatID="0" Quantity="{c.get("count", 1)}" Sideboard="false" Name="{c.get("name")}" />')
            lines.append('</Deck>')
            content = "\n".join(lines)
            media_type = "application/xml"
            filename = "collection_export.dek"

        elif format == "json":
            json_cards = []
            for c in cards:
                c["_id"] = str(c["_id"])
                json_cards.append(c)
            content = json.dumps(json_cards, indent=2)
            media_type = "application/json"
            filename = "collection_export.json"
            
        else:
            raise HTTPException(status_code=400, detail="Format d'exportation non supporte.")

        history_entry = {
            "user_id": uid,
            "type": "EXPORT",
            "date": datetime.utcnow(),
            "details": f"Export {format.upper()} - {unique_cards} cartes uniques ({total_cards} au total)",
            "status": "success",
            "cards": [] 
        }
        history_collection.insert_one(history_entry)

        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur Export: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne lors de l'exportation.")