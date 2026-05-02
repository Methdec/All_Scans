from fastapi import APIRouter, HTTPException, Body, Depends
from bson import ObjectId
from database import tag_rules_collection, user_cards_collection
from routes.auth_routes import get_current_user

router = APIRouter()

@router.get("/rules")
async def get_tag_rules(user_id: str = Depends(get_current_user)):
    """Recupere toutes les regles de tags automatiques de l'utilisateur."""
    rules = list(tag_rules_collection.find({"user_id": user_id}))
    for r in rules:
        r["id"] = str(r["_id"])
        del r["_id"]
    return {"rules": rules}

@router.post("/rules")
async def create_tag_rule(data: dict = Body(...), user_id: str = Depends(get_current_user)):
    """Cree une nouvelle regle d'automatisation de tags."""
    tag_name = data.get("tag_name")
    conditions = data.get("conditions") 
    logic = data.get("logic", "AND")
    color = data.get("color", "#FF9800") # NOUVEAU

    if not tag_name or not conditions:
        raise HTTPException(status_code=400, detail="Le nom du tag et les conditions sont requis.")

    new_rule = {
        "user_id": user_id,
        "tag_name": tag_name.strip().lower(),
        "logic": logic,
        "color": color, # NOUVEAU
        "conditions": conditions
    }

    result = tag_rules_collection.insert_one(new_rule)
    return {"message": "Regle creee avec succes", "id": str(result.inserted_id)}

@router.delete("/rules/{rule_id}")
async def delete_tag_rule(rule_id: str, user_id: str = Depends(get_current_user)):
    """Supprime une règle ET retire ce tag de toutes les cartes."""
    if not ObjectId.is_valid(rule_id):
        raise HTTPException(status_code=400, detail="ID de règle invalide.")

    rule = tag_rules_collection.find_one({"_id": ObjectId(rule_id), "user_id": user_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Règle introuvable.")
        
    tag_name = rule.get("tag_name")

    tag_rules_collection.delete_one({"_id": ObjectId(rule_id)})
    
    if tag_name:
        user_cards_collection.update_many(
            {"user_id": user_id},
            {"$pull": {"tags": tag_name}}
        )

    return {"message": "Règle supprimée et tags nettoyés sur vos cartes."}


@router.put("/rules/{rule_id}")
async def update_tag_rule(rule_id: str, data: dict = Body(...), user_id: str = Depends(get_current_user)):
    """Met à jour une règle existante et nettoie l'ancien tag s'il a été renommé."""
    if not ObjectId.is_valid(rule_id):
        raise HTTPException(status_code=400, detail="ID de règle invalide.")

    tag_name = data.get("tag_name")
    conditions = data.get("conditions")
    logic = data.get("logic", "AND")
    color = data.get("color", "#FF9800") # NOUVEAU

    if not tag_name or not conditions:
        raise HTTPException(status_code=400, detail="Le nom du tag et les conditions sont requis.")

    old_rule = tag_rules_collection.find_one({"_id": ObjectId(rule_id), "user_id": user_id})
    if not old_rule:
        raise HTTPException(status_code=404, detail="Règle introuvable.")

    old_tag_name = old_rule.get("tag_name")
    new_tag_name = tag_name.strip().lower()

    updated_rule = {
        "tag_name": new_tag_name,
        "logic": logic,
        "color": color, # NOUVEAU
        "conditions": conditions
    }

    tag_rules_collection.update_one(
        {"_id": ObjectId(rule_id), "user_id": user_id},
        {"$set": updated_rule}
    )

    if old_tag_name and old_tag_name != new_tag_name:
        user_cards_collection.update_many(
            {"user_id": user_id},
            {"$pull": {"tags": old_tag_name}}
        )

    return {"message": "Règle mise à jour avec succès"}