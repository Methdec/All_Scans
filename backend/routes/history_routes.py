# routes/history_routes.py
from fastapi import APIRouter, HTTPException, Depends
from database import history_collection, user_cards_collection
from routes.auth_routes import get_current_user
from bson import ObjectId
import logging

logger = logging.getLogger("revert_import")

router = APIRouter()

@router.get("/history")
async def get_user_history(user_id: str = Depends(get_current_user)):
    try:
        # Récupère l'historique du plus récent au plus ancien
        cursor = history_collection.find({"user_id": user_id}).sort("date", -1).limit(50)
        history_list = []
        
        for entry in cursor:
            entry["_id"] = str(entry["_id"])
            history_list.append(entry)
            
        return {"history": history_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history")
async def clear_user_history(user_id: str = Depends(get_current_user)):
    try:
        result = history_collection.delete_many({"user_id": user_id})
        return {"message": f"Historique effacé. {result.deleted_count} entrées supprimées."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/history/{history_id}/revert")
async def revert_history_import(history_id: str, user_id: str = Depends(get_current_user)):
    try:
        uid = str(user_id)
        
        # 1. On cherche l'entree dans l'historique
        if not ObjectId.is_valid(history_id):
            raise HTTPException(status_code=400, detail="ID d'historique invalide")
            
        entry = history_collection.find_one({"_id": ObjectId(history_id), "user_id": uid})
        
        if not entry:
            raise HTTPException(status_code=404, detail="Historique introuvable")
            
        if entry.get("type") != "IMPORT":
            raise HTTPException(status_code=400, detail="Seuls les imports peuvent etre annules")

        # 2. On parcourt les cartes pour soustraire les quantites
        cards = entry.get("cards", [])
        reverted_count = 0
        
        for card in cards:
            if card.get("found") and card.get("id"):
                card_id = str(card["id"])
                qty_to_remove = card.get("quantity", 1)
                
                # On cherche la carte dans la collection de l'utilisateur
                user_card = user_cards_collection.find_one({"user_id": uid, "card_id": card_id})
                
                if user_card:
                    new_count = user_card.get("count", 0) - qty_to_remove
                    
                    if new_count <= 0:
                        # Si on tombe a 0 ou moins, on supprime completement la carte de la collection
                        user_cards_collection.delete_one({"_id": user_card["_id"]})
                    else:
                        # Sinon on met a jour la quantite restante
                        user_cards_collection.update_one(
                            {"_id": user_card["_id"]},
                            {"$set": {"count": new_count}}
                        )
                
                reverted_count += qty_to_remove

        # 3. On supprime la ligne de l'historique pour confirmer l'annulation
        history_collection.delete_one({"_id": ObjectId(history_id)})

        return {"message": "Import annule avec succes", "reverted_count": reverted_count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur Revert Import: {e}")
        raise HTTPException(status_code=500, detail=str(e))