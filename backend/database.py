from pymongo import MongoClient
import os


MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "All_scans")

print(f"Connexion à Mongo via : {MONGO_URI}")
print(f"Base de données : {DB_NAME}")

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info() 
except Exception as e:
    print(f"Erreur critique de connexion MongoDB : {e}")

db = client[DB_NAME]

# Collections
items_collection = db["Items"]
cards_collection = db["Cards"]
user_cards_collection = db["UserCards"]
users_collection = db["Users"]