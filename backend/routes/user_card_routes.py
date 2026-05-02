# routes/user_card_routes.py
from fastapi import APIRouter, HTTPException, Depends, Request, Body, Query
from database import user_cards_collection, cards_collection, history_collection, tag_rules_collection
from routes.auth_routes import get_current_user
from models.card import extract_card_fields
from bson import ObjectId
from datetime import datetime
from typing import List, Dict
from fastapi.responses import PlainTextResponse, Response
from utils.import_parser import parse_mtg_line
from bson.errors import InvalidId
from utils.tags_engine import get_automated_tags
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
        
        # NOUVEAU : On récupère les règles de l'utilisateur avant la boucle
        user_rules = list(tag_rules_collection.find({"user_id": uid}))
        
        for idx, scryfall_data in enumerate(fetched_cards):
            if idx % 5 == 0:
                await asyncio.sleep(0.02)

            cleaned = extract_card_fields(scryfall_data)
            card_id = cleaned.get("id")
            
            # NOUVEAU : On calcule les tags automatiques pour cette carte
            auto_tags = get_automated_tags(cleaned, user_rules)
            
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
                        # NOUVEAU : Ajout des tags en cas de mise à jour
                        update_doc = {"$inc": {"count": qty}}
                        if auto_tags:
                            update_doc["$addToSet"] = {"tags": {"$each": auto_tags}}
                        user_cards_collection.update_one({"_id": existing["_id"]}, update_doc)
                    else:
                        # NOUVEAU : Ajout des tags en cas de création
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
                            "purchase_uris": cleaned.get("purchase_uris", {}),
                            "tags": auto_tags # <-- INCLUSION ICI
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
                "id": "unknown",
                "name": f"{info['name']}{is_foil_tag}",
                "found": False,
                "quantity": info["quantity"]
            })

        total_found = len(cards_found)
        total_missing = len(cards_not_found)
        
        status = "success" if total_missing == 0 else "warning" if total_found > 0 else "error"

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
        
        # NOUVEAU : Application du moteur de tags
        user_rules = list(tag_rules_collection.find({"user_id": uid}))
        auto_tags = get_automated_tags(cleaned, user_rules)
        print(f"[Tags] Ajout manuel de {cleaned.get('name')} -> Tags trouvés : {auto_tags}")
        
        if existing:
            update_doc = {"$inc": {"count": 1}}
            if auto_tags:
                update_doc["$addToSet"] = {"tags": {"$each": auto_tags}}
            user_cards_collection.update_one({"_id": existing["_id"]}, update_doc)
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
                "purchase_uris": cleaned.get("purchase_uris", {}),
                "tags": auto_tags # <-- INCLUSION ICI
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
    


@router.get("/me/collection/tags")
async def get_my_collection_tags(user_id: str = Depends(get_current_user)):
    """Recupere la liste de tous les tags uniques utilises dans la collection de l'utilisateur."""
    tags = user_cards_collection.distinct("tags", {"user_id": user_id})
    clean_tags = [t for t in tags if t]
    return {"tags": sorted(clean_tags)}



@router.post("/{card_id}/tags")
async def add_tag_to_card(card_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    tag = data.get("tag")
    if not tag:
        raise HTTPException(status_code=400, detail="Le nom du tag est manquant.")
        
    clean_tag = tag.strip().lower()
    
    # Recherche flexible : soit l'ObjectId MongoDB, soit l'UUID Scryfall
    query = {"user_id": user_id}
    if ObjectId.is_valid(card_id):
        query["_id"] = ObjectId(card_id)
    else:
        query["card_id"] = card_id
        
    # update_many permet de taguer toutes les versions (ex: foil et non-foil) d'un coup
    result = user_cards_collection.update_many(
        query,
        {"$addToSet": {"tags": clean_tag}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Carte introuvable dans votre collection.")
        
    return {"message": "Tag ajoute avec succes", "tag": clean_tag}

@router.delete("/{card_id}/tags")
async def remove_tag_from_card(card_id: str, tag: str = Query(...), user_id: str = Depends(get_current_user)):
    clean_tag = tag.strip().lower()
    
    query = {"user_id": user_id}
    if ObjectId.is_valid(card_id):
        query["_id"] = ObjectId(card_id)
    else:
        query["card_id"] = card_id
    
    result = user_cards_collection.update_many(
        query,
        {"$pull": {"tags": clean_tag}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Carte introuvable dans votre collection.")
        
    return {"message": "Tag supprime avec succes"}




@router.post("/usercards/{old_card_id}/swap")
async def swap_card_version(old_card_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    """Remplace une quantite specifique d'une carte par une autre version de cette carte."""
    try:
        uid = str(user_id)
        new_card_data = data.get("new_card")
        
        # 1. Securite sur la quantite
        try:
            quantity = int(data.get("quantity", 1))
        except (ValueError, TypeError):
            quantity = 1
            
        is_foil = bool(data.get("is_foil", False))

        if not new_card_data or not new_card_data.get("id"):
            raise HTTPException(status_code=400, detail="Donnees de la nouvelle carte manquantes.")

        new_card_id = new_card_data["id"]

        # 2. Identifier l'ancienne carte
        if ObjectId.is_valid(old_card_id):
            old_query = {"user_id": uid, "_id": ObjectId(old_card_id)}
        else:
            old_query = {"user_id": uid, "card_id": old_card_id, "is_foil": is_foil}

        old_uc = user_cards_collection.find_one(old_query)
        if not old_uc:
            raise HTTPException(status_code=404, detail="L'ancienne carte n'est pas dans votre collection.")

        # 3. Recuperer les tags manuels existants pour les transferer
        tags_to_transfer = old_uc.get("tags")
        if not isinstance(tags_to_transfer, list):
            tags_to_transfer = []

        # 4. Appliquer le moteur de tags automatiques sur la NOUVELLE version
        user_rules = list(tag_rules_collection.find({"user_id": uid}))
        # On nettoie les champs de la nouvelle carte pour le moteur
        cleaned_new_card = extract_card_fields(new_card_data)
        auto_tags = get_automated_tags(cleaned_new_card, user_rules)
        
        # Fusionner les anciens tags manuels et les nouveaux tags automatiques
        final_tags = list(set(tags_to_transfer + auto_tags))

        # 5. Decrementer ou supprimer l'ancienne carte
        current_count = old_uc.get("count", 1)
        if current_count <= quantity:
            user_cards_collection.delete_one(old_query)
        else:
            user_cards_collection.update_one(old_query, {"$inc": {"count": -quantity}})

        # 6. Assurer que la nouvelle carte existe dans la base globale
        new_card_data.pop("_id", None)
        if not cards_collection.find_one({"id": new_card_id}):
            new_card_data["owners"] = [uid]
            cards_collection.insert_one(cleaned_new_card)
        else:
            cards_collection.update_one({"id": new_card_id}, {"$addToSet": {"owners": uid}})

        # 7. Ajouter ou mettre a jour la nouvelle version chez l'utilisateur
        new_query = {"user_id": uid, "card_id": new_card_id, "is_foil": is_foil}
        new_uc = user_cards_collection.find_one(new_query)

        if new_uc:
            user_cards_collection.update_one(new_query, {
                "$inc": {"count": quantity},
                "$addToSet": {"tags": {"$each": final_tags}}
            })
        else:
            user_doc = {
                "user_id": uid,
                "card_id": new_card_id,
                "count": quantity,
                "is_foil": is_foil,
                "name": cleaned_new_card.get("name"),
                "lang": cleaned_new_card.get("lang"),
                "oracle_id": cleaned_new_card.get("oracle_id"),
                "set": cleaned_new_card.get("set"),
                "set_name": cleaned_new_card.get("set_name"),
                "collector_number": cleaned_new_card.get("collector_number"),
                "image_normal": cleaned_new_card.get("image_normal"),
                "rarity": cleaned_new_card.get("rarity"),
                "colors": cleaned_new_card.get("colors", []),
                "type_line": cleaned_new_card.get("type_line", ""),
                "oracle_text": cleaned_new_card.get("oracle_text", ""),
                "cmc": cleaned_new_card.get("cmc", 0),
                "prices": cleaned_new_card.get("prices", {}),
                "tags": final_tags # Applique les tags calcules ici
            }
            user_cards_collection.insert_one(user_doc)

        print(f"[Tags] Swap vers {cleaned_new_card.get('name')} termine avec tags : {final_tags}")
        return {"message": "Echange reussi", "new_card_id": new_card_id}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))