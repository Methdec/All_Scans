from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pymongo import MongoClient
from bson import ObjectId
from routes.auth_routes import get_current_user
from database import items_collection, user_cards_collection, cards_collection, history_collection
from collections import Counter 
from models.card import extract_card_fields
from utils.import_parser import parse_mtg_line
import math
import re
import httpx
from datetime import datetime

router = APIRouter(prefix="/items", tags=["items"])

BASIC_LAND_NAMES = {
    "W": "Plains", "U": "Island", "B": "Swamp", "R": "Mountain", "G": "Forest", "C": "Wastes"
}

FALLBACK_LAND_IDS = {
    "Plains": "22990926-3701-4470-a363-229202a0a202",
    "Island": "03473a21-9923-4e4b-972c-f60447092497",
    "Swamp": "6c434934-2977-4409-9fc6-948677026772",
    "Mountain": "787c800b-3375-4428-a640-62432824d772",
    "Forest": "59b434cb-9c09-4d64-9279-373307b66782",
    "Wastes": "9cc070d3-4b83-4684-9caf-063d4c47c8bb"
}

async def ensure_card_exists_in_db(card_id: str):
    if not cards_collection.find_one({"id": card_id}):
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"https://api.scryfall.com/cards/{card_id}")
                if resp.status_code == 200:
                    from models.card import extract_card_fields
                    cleaned = extract_card_fields(resp.json())
                    cards_collection.insert_one(cleaned)
            except Exception as e:
                print(f"Erreur fallback download {card_id}: {e}")

@router.get("/folders/all")
def get_all_folders(user_id: str = Depends(get_current_user)):
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
        "image": image, "cards": [], "sideboard": []
    }
    if type_ == "deck": new_item["format"] = format_

    result = items_collection.insert_one(new_item)
    return {"message": f"{type_.capitalize()} cree", "id": str(result.inserted_id)}

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
            
        item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
        if not item: raise HTTPException(status_code=404, detail="Introuvable")

        if item.get("type") == "deck":
            main_counts = Counter(item.get("cards", []))
            side_counts = Counter(item.get("sideboard", []))
            unique_ids = list(set(main_counts.keys()).union(side_counts.keys()))
            
            global_cards = list(cards_collection.find({"id": {"$in": unique_ids}}))
            cards_map = {c["id"]: c for c in global_cards}
            
            # --- CORRECTION 1 : On compte TOUTES les editions et foils par le NOM ! ---
            deck_card_names = [c.get("name") for c in global_cards if c.get("name")]
            
            user_cards_cursor = user_cards_collection.find({"user_id": user_id, "name": {"$in": deck_card_names}})
            user_cards_map = {}
            for uc in user_cards_cursor:
                c_name = uc.get("name")
                if c_name:
                    user_cards_map[c_name] = user_cards_map.get(c_name, 0) + uc.get("count", 0)
            
            enriched_cards = []
            
            for card_id in unique_ids:
                details = cards_map.get(card_id)
                if details:
                    m_qty = main_counts.get(card_id, 0)
                    s_qty = side_counts.get(card_id, 0)
                    
                    c_name = details.get("name")
                    
                    base_data = {
                        "card_id": card_id,
                        "name": c_name,
                        "image_normal": details.get("image_normal"),
                        "image_art_crop": details.get("image_art_crop"),
                        "mana_cost": details.get("mana_cost", ""), 
                        "type_line": details.get("type_line", ""),
                        "colors": details.get("colors", []),
                        "cmc": details.get("cmc", 0),
                        "set_name": details.get("set_name", details.get("set", "???").upper()),
                        "owned_count": user_cards_map.get(c_name, 0) # Utilise la quantité totale possédée pour ce nom !
                    }
                    
                    if m_qty > 0:
                        c_main = base_data.copy()
                        c_main["quantity"] = m_qty
                        c_main["is_sideboard"] = False
                        enriched_cards.append(c_main)
                        
                    if s_qty > 0:
                        c_side = base_data.copy()
                        c_side["quantity"] = s_qty
                        c_side["is_sideboard"] = True
                        enriched_cards.append(c_side)
                
            item["cards"] = enriched_cards

        item["id"] = str(item["_id"])
        del item["_id"]
        
        return item

    except Exception as e:
        print(f"Erreur Get Item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{item_id}")
async def update_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    uid = str(user_id)
    update_fields = {}
    if "nom" in data: update_fields["nom"] = data["nom"]
    if "format" in data: update_fields["format"] = data["format"]
    if "image" in data: update_fields["image"] = data["image"]
    if "parent_id" in data: update_fields["parent_id"] = data["parent_id"]

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": uid})
    if not item: raise HTTPException(status_code=404, detail="Item non trouve")

    if "is_constructed" in data:
        target_status = data["is_constructed"]
        current_status = item.get("is_constructed", False)

        if target_status and not current_status:
            all_cards_to_build = item.get("cards", []) + item.get("sideboard", [])
            card_counts = Counter(all_cards_to_build)
            missing_details = []
            cards_to_lock = []
            swaps_to_make = []

            unique_ids = list(card_counts.keys())
            global_cards = {c["id"]: c for c in cards_collection.find({"id": {"$in": unique_ids}})}

            for cid, required_qty in card_counts.items():
                user_card = user_cards_collection.find_one({"user_id": uid, "card_id": cid})
                global_card = global_cards.get(cid)
                
                card_name = cid
                if user_card and "name" in user_card:
                    card_name = user_card["name"]
                elif global_card and "name" in global_card:
                    card_name = global_card["name"]

                total_owned = user_card.get("count", 0) if user_card else 0
                assigned = user_card.get("assigned_count", 0) if user_card else 0
                available = total_owned - assigned

                if available < required_qty:
                    shortage = required_qty - available
                    
                    alternatives = list(user_cards_collection.find({
                        "user_id": uid, "name": card_name, "card_id": {"$ne": cid}
                    }))

                    found_alternatives = []
                    current_shortage = shortage

                    for alt in alternatives:
                        if current_shortage <= 0: break
                        alt_avail = alt.get("count", 0) - alt.get("assigned_count", 0)
                        if alt_avail > 0:
                            take = min(current_shortage, alt_avail)
                            found_alternatives.append({
                                "_id": alt["_id"], "id": alt["card_id"], "name": alt.get("name", card_name), "qty": take
                            })
                            current_shortage -= take

                    if current_shortage == 0:
                        if available > 0:
                            cards_to_lock.append({"_id": user_card["_id"], "qty": available, "name": card_name, "id": cid})
                        cards_to_lock.extend(found_alternatives)
                        swaps_to_make.append({"old_id": cid, "qty_to_swap": shortage, "new_cards": found_alternatives})
                        continue 

                    total_alt_avail = sum([alt.get("count", 0) - alt.get("assigned_count", 0) for alt in alternatives])
                    true_available = available + total_alt_avail

                    using_decks = items_collection.find({
                        "user_id": uid, "type": "deck", "is_constructed": True,
                        "$or": [{"cards": cid}, {"sideboard": cid}]
                    })
                    
                    used_in_list = []
                    for d in using_decks:
                        qty_in_this_deck = d.get("cards", []).count(cid) + d.get("sideboard", []).count(cid)
                        if qty_in_this_deck > 0 and str(d["_id"]) != item_id:
                            used_in_list.append(f"{d.get('nom', 'Deck inconnu')} (x{qty_in_this_deck})")

                    reason = "assigned_elsewhere" if (true_available > 0 and used_in_list) else "not_in_collection"

                    missing_details.append({
                        "name": card_name, "required": required_qty, "available": true_available,
                        "reason": reason, "used_in": used_in_list
                    })
                else:
                    cards_to_lock.append({"_id": user_card["_id"], "qty": required_qty, "name": card_name, "id": cid})

            if missing_details:
                raise HTTPException(
                    status_code=400, 
                    detail={"message": "Impossible de construire le deck.", "missing_cards": missing_details}
                )

            if swaps_to_make:
                new_deck_list = item.get("cards", []).copy()
                for swap in swaps_to_make:
                    for _ in range(swap["qty_to_swap"]):
                        if swap["old_id"] in new_deck_list:
                            new_deck_list.remove(swap["old_id"])
                    for new_c in swap["new_cards"]:
                        new_deck_list.extend([new_c["id"]] * new_c["qty"])
                update_fields["cards"] = new_deck_list

            history_cards = []
            for c in cards_to_lock:
                user_cards_collection.update_one({"_id": c["_id"]}, {"$inc": {"assigned_count": c["qty"]}})
                history_cards.append({"id": c["id"], "name": c["name"], "found": True, "quantity": c["qty"]})

            history_collection.insert_one({
                "user_id": uid, "type": "DECK_BUILD", "date": datetime.utcnow(),
                "details": f"Construction du deck : {item.get('nom', 'Inconnu')}", "status": "success",
                "cards": history_cards
            })
            update_fields["is_constructed"] = True

        elif not target_status and current_status:
            all_cards_to_free = item.get("cards", []) + item.get("sideboard", [])
            card_counts = Counter(all_cards_to_free)
            history_cards = []

            for cid, qty_to_free in card_counts.items():
                user_card = user_cards_collection.find_one({"user_id": uid, "card_id": cid})
                if user_card and user_card.get("assigned_count", 0) > 0:
                    user_cards_collection.update_one({"_id": user_card["_id"]}, {"$inc": {"assigned_count": -qty_to_free}})
                    history_cards.append({"id": cid, "name": user_card.get("name", "Carte inconnue"), "found": True, "quantity": qty_to_free})

            history_collection.insert_one({
                "user_id": uid, "type": "DECK_UNBUILD", "date": datetime.utcnow(),
                "details": f"Demantelement du deck : {item.get('nom', 'Inconnu')}", "status": "success",
                "cards": history_cards
            })
            update_fields["is_constructed"] = False

    if not update_fields: 
        raise HTTPException(status_code=400, detail="Aucune donnee a modifier")

    items_collection.update_one({"_id": ObjectId(item_id), "user_id": uid}, {"$set": update_fields})
    return {"message": "Mise a jour effectuee"}

@router.delete("/{item_id}")
def delete_item(item_id: str, user_id: str = Depends(get_current_user)):
    result = items_collection.delete_one({"_id": ObjectId(item_id), "user_id": user_id})
    if result.deleted_count == 1: return {"message": "Element supprime"}
    raise HTTPException(status_code=404, detail="Element non trouve")

@router.post("/{item_id}/add_card")
async def add_card_to_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    card_id_received = data.get("card_id")
    is_sideboard = data.get("is_sideboard", False)
    
    if not card_id_received: raise HTTPException(status_code=400, detail="Aucun ID fourni")

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item: raise HTTPException(status_code=404, detail="Item non trouve")
    if item["type"] != "deck": raise HTTPException(status_code=400, detail="Ce n'est pas un deck")
    if item.get("is_constructed", False): raise HTTPException(status_code=400, detail="Veuillez demonter le deck au prealable.")

    target_scryfall_id = card_id_received
    card_image = None

    if ObjectId.is_valid(card_id_received):
        user_card = user_cards_collection.find_one({"_id": ObjectId(card_id_received)})
        if user_card:
            target_scryfall_id = user_card.get("card_id")
            card_image = user_card.get("image_art_crop") or user_card.get("image_normal")
        else:
            global_card = cards_collection.find_one({"_id": ObjectId(card_id_received)})
            if global_card:
                target_scryfall_id = global_card.get("id")
                card_image = global_card.get("image_art_crop") or global_card.get("image_normal")
    else:
        global_card = cards_collection.find_one({"id": card_id_received})
        if global_card: card_image = global_card.get("image_art_crop") or global_card.get("image_normal")

    target_array = "sideboard" if is_sideboard else "cards"
    update_query = {"$push": {target_array: target_scryfall_id}}
    
    if not item.get("image") and card_image and not is_sideboard:
        update_query["$set"] = {"image": card_image}

    items_collection.update_one({"_id": ObjectId(item_id)}, update_query)
    return {"message": "Carte ajoutee", "added_id": target_scryfall_id}

@router.post("/{item_id}/remove_card")
async def remove_card_from_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    card_id = data.get("card_id")
    is_sideboard = data.get("is_sideboard", False)
    
    if not card_id: raise HTTPException(status_code=400, detail="Aucun ID de carte fourni")

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item: raise HTTPException(status_code=404, detail="Item non trouve")
    if item.get("is_constructed", False): raise HTTPException(status_code=400, detail="Veuillez demonter au prealable.")

    target_array = "sideboard" if is_sideboard else "cards"
    current_cards = item.get(target_array, [])
    
    if card_id in current_cards:
        current_cards.remove(card_id) 
        items_collection.update_one({"_id": ObjectId(item_id)}, {"$set": {target_array: current_cards}})
        return {"message": "Carte retiree"}
    else:
        raise HTTPException(status_code=404, detail="Carte non presente")

@router.post("/{item_id}/toggle_board")
async def toggle_card_board(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    card_id = data.get("card_id")
    from_sideboard = data.get("from_sideboard", False)
    
    if not card_id: raise HTTPException(status_code=400, detail="Aucun ID fourni")

    item = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not item: raise HTTPException(status_code=404, detail="Item non trouve")
    if item.get("is_constructed", False): raise HTTPException(status_code=400, detail="Veuillez demonter au prealable.")

    source_array = "sideboard" if from_sideboard else "cards"
    dest_array = "cards" if from_sideboard else "sideboard"
    
    current_source = item.get(source_array, [])
    current_dest = item.get(dest_array, [])
    
    if card_id in current_source:
        current_source.remove(card_id)
        current_dest.append(card_id)
        items_collection.update_one(
            {"_id": ObjectId(item_id)}, 
            {"$set": {source_array: current_source, dest_array: current_dest}}
        )
        return {"message": "Carte deplacee avec succes"}
    else:
        raise HTTPException(status_code=404, detail="Carte non trouvee dans la zone d'origine")

@router.post("/{item_id}/duplicate")
def duplicate_item(item_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    original = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
    if not original: raise HTTPException(status_code=404, detail="Item original non trouve")

    new_item = {
        "user_id": user_id, "type": original["type"], "nom": data.get("new_name", f"Copie - {original['nom']}"),
        "parent_id": data.get("parent_id", original.get("parent_id")), "image": original.get("image"),
        "cards": original.get("cards", []), "sideboard": original.get("sideboard", []),
        "format": original.get("format", "standard")
    }

    result = items_collection.insert_one(new_item)
    return {"message": "Copie creee", "new_id": str(result.inserted_id)}

@router.post("/{item_id}/auto_balance_lands")
async def auto_balance_lands(item_id: str, user_id: str = Depends(get_current_user)):
    try:
        if not ObjectId.is_valid(item_id): raise HTTPException(status_code=400, detail="ID Invalide")
        deck = items_collection.find_one({"_id": ObjectId(item_id), "user_id": user_id})
        if not deck or deck.get("type") != "deck": raise HTTPException(status_code=404, detail="Deck introuvable")

        current_card_ids = deck.get("cards", [])
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
            is_basic = name in BASIC_LAND_NAMES.values()
            
            if "Land" in type_line:
                if not is_basic: non_basic_count += 1
                continue 

            mana_cost = details.get("mana_cost", "")
            for color_code in ["W", "U", "B", "R", "G", "C"]:
                c = mana_cost.count("{" + color_code + "}")
                if c > 0:
                    pips[color_code] += c
                    total_pips += c

        target_total = 36 if deck.get("format", "").lower() == "commander" else 24
        slots_for_basics = target_total - non_basic_count

        if slots_for_basics <= 0: return {"message": "Pas de place pour des terrains basiques.", "logs": []}
        if total_pips == 0: return {"message": "Aucun symbole de couleur detecte.", "logs": []}

        logs = []
        for color, pips_count in pips.items():
            if pips_count == 0: continue
            land_name = BASIC_LAND_NAMES.get(color)
            if not land_name: continue

            ideal_count = round((pips_count / total_pips) * slots_for_basics)
            current_ids_in_deck = [cid for cid in final_deck_list if cards_map.get(cid, {}).get("name") == land_name]
            current_count = len(current_ids_in_deck)
            diff = ideal_count - current_count

            if diff < 0:
                to_remove = abs(diff)
                logs.append(f"- {to_remove} {land_name}")
                removed = 0
                for cid in list(final_deck_list):
                    if removed >= to_remove: break
                    if cards_map.get(cid, {}).get("name") == land_name:
                        final_deck_list.remove(cid)
                        removed += 1

            elif diff > 0:
                to_add = diff
                logs.append(f"+ {to_add} {land_name}")
                candidates = list(user_cards_collection.find({"user_id": user_id, "name": land_name}))
                added_count = 0
                
                for cand in candidates:
                    if added_count >= to_add: break
                    cand_id = cand["card_id"]
                    qty_owned = cand.get("count", 0)
                    already_in_deck = final_deck_list.count(cand_id)
                    available = qty_owned - already_in_deck
                    if available > 0:
                        qty_to_take = min(to_add - added_count, available)
                        final_deck_list.extend([cand_id] * qty_to_take)
                        added_count += qty_to_take
                
                remaining = to_add - added_count
                if remaining > 0:
                    fallback_id = FALLBACK_LAND_IDS.get(land_name)
                    if fallback_id:
                        await ensure_card_exists_in_db(fallback_id)
                        final_deck_list.extend([fallback_id] * remaining)
                        logs.append(f"  (Alerte : {remaining} ajoutes depuis le stock infini)")

        items_collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"cards": final_deck_list}})
        return {"message": "Deck equilibre avec succes", "logs": logs, "new_count": len(final_deck_list)}

    except Exception as e:
        print(f"Erreur Auto Balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/path/{item_id}")
def get_item_hierarchy(item_id: str, user_id: str = Depends(get_current_user)):
    try:
        path = []
        current_id = item_id
        for _ in range(20): 
            if not current_id or not ObjectId.is_valid(current_id): break
            item = items_collection.find_one({"_id": ObjectId(current_id)}, {"nom": 1, "parent_id": 1})
            if not item: break
            path.insert(0, {"id": str(item["_id"]), "name": item["nom"]})
            current_id = item.get("parent_id")
        return {"path": path}
    except Exception as e:
        print(f"Erreur Path: {e}")
        return {"path": []}

@router.post("/import_deck")
async def import_deck_from_text(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    nom = data.get("nom")
    format_ = data.get("format", "standard")
    parent_id = data.get("parent_id")
    decklist = data.get("decklist", "")

    if not nom or not decklist:
        raise HTTPException(status_code=400, detail="Nom et liste de deck requis.")

    lines = decklist.split("\n")
    parsed_main = []
    parsed_side = []
    
    in_sideboard = False
    
    for line in lines:
        line_str = line.strip()
        if not line_str: continue
        
        if line_str.upper() == "SIDEBOARD:" or line_str.upper() == "SIDEBOARD":
            in_sideboard = True
            continue
            
        parsed = parse_mtg_line(line_str)
        if parsed:
            if in_sideboard:
                parsed["is_sideboard"] = True
                
            if parsed["is_sideboard"]:
                parsed_side.append(parsed)
            else:
                parsed_main.append(parsed)

    if not parsed_main and not parsed_side:
        raise HTTPException(status_code=400, detail="La liste fournie ne contient aucune carte valide.")

    identifiers = []
    for c in parsed_main + parsed_side:
        ident = {}
        # --- CORRECTION 2 : On isole la face avant pour Scryfall ---
        front_face_name = c["name"].split("//")[0].strip()
        
        if c["set"] and c["collector_number"]:
            ident["set"] = c["set"]
            ident["collector_number"] = str(c["collector_number"])
        elif c["set"]:
            ident["name"] = front_face_name
            ident["set"] = c["set"]
        else:
            ident["name"] = front_face_name
        identifiers.append(ident)

    found_cards = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(0, len(identifiers), 75):
            chunk = identifiers[i:i+75]
            try:
                resp = await client.post("https://api.scryfall.com/cards/collection", json={"identifiers": chunk})
                if resp.status_code == 200:
                    found_cards.extend(resp.json().get("data", []))
            except Exception as e:
                print(f"Erreur Scryfall Batch Import: {e}")

    for scryfall_card in found_cards:
        cleaned = extract_card_fields(scryfall_card)
        card_id = cleaned["id"]
        if not cards_collection.find_one({"id": card_id}):
            cleaned["owners"] = [] 
            cards_collection.insert_one(cleaned)

    deck_main_ids = []
    deck_side_ids = []
    missing_cards = []
    
    for pc in parsed_main:
        matched = False
        pc_front = pc["name"].split("//")[0].strip().lower()
        for scryfall_card in found_cards:
            c_name = scryfall_card["name"].split("//")[0].strip().lower()
            if pc_front in c_name or c_name in pc_front:
                deck_main_ids.extend([scryfall_card["id"]] * pc["qty"])
                matched = True
                break
        if not matched:
            missing_cards.append({"name": pc["name"], "qty": pc["qty"], "zone": "Principal"})

    for pc in parsed_side:
        matched = False
        pc_front = pc["name"].split("//")[0].strip().lower()
        for scryfall_card in found_cards:
            c_name = scryfall_card["name"].split("//")[0].strip().lower()
            if pc_front in c_name or c_name in pc_front:
                deck_side_ids.extend([scryfall_card["id"]] * pc["qty"])
                matched = True
                break
        if not matched:
            missing_cards.append({"name": pc["name"], "qty": pc["qty"], "zone": "Reserve"})

    first_image = None
    if found_cards:
        if "image_uris" in found_cards[0] and "art_crop" in found_cards[0]["image_uris"]:
            first_image = found_cards[0]["image_uris"]["art_crop"]
        elif "card_faces" in found_cards[0] and "image_uris" in found_cards[0]["card_faces"][0] and "art_crop" in found_cards[0]["card_faces"][0]["image_uris"]:
            first_image = found_cards[0]["card_faces"][0]["image_uris"]["art_crop"]
        elif "image_uris" in found_cards[0] and "normal" in found_cards[0]["image_uris"]:
            first_image = found_cards[0]["image_uris"]["normal"]

    new_item = {
        "user_id": user_id, 
        "type": "deck", 
        "nom": nom, 
        "parent_id": parent_id,
        "image": first_image, 
        "cards": deck_main_ids,
        "sideboard": deck_side_ids,
        "format": format_,
        "is_constructed": False
    }
    
    result = items_collection.insert_one(new_item)
    
    return {
        "message": "Deck importe", 
        "id": str(result.inserted_id),
        "missing_cards": missing_cards
    }