from fastapi import APIRouter, HTTPException
from models.user import User
from bson import ObjectId

router = APIRouter()

# On importe la collection directement depuis notre fichier centralisé
from database import users_collection

@router.post("/users")
def create_user(user: User):
    result = users_collection.insert_one(user.dict(exclude={"id"}))
    return {"message": "Utilisateur ajouté", "id": str(result.inserted_id)}

@router.get("/users")
def get_users():
    users = list(users_collection.find())
    for user in users:
        user["id"] = str(user["_id"])
        del user["_id"]
    return {"users": users}

@router.get("/users/{user_id}")
def get_user(user_id: str):
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user:
        user["id"] = str(user["_id"])
        del user["_id"]
        return user
    raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

@router.put("/users/{user_id}")
def update_user(user_id: str, user: User):
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": user.dict(exclude={"id"})}
    )
    if result.modified_count == 1:
        return {"message": "Utilisateur mis à jour"}
    raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

@router.delete("/users/{user_id}")
def delete_user(user_id: str):
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 1:
        return {"message": "Utilisateur supprimé"}
    raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
