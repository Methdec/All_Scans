from pymongo import MongoClient
import os 

client = MongoClient("mongodb://localhost:27017/")

DB_NAME = os.getenv("MONGO_DB_NAME", "All_scans")

print(f"Connexion à la base de données : {DB_NAME}") 

db = client[DB_NAME]


items_collection = db["Items"]
cards_collection = db["Cards"]
user_cards_collection = db["UserCards"]
users_collection = db["Users"]