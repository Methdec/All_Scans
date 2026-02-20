# reset_db.py
from database import cards_collection, user_cards_collection, items_collection

def reset_database():
    print("⚠️ ATTENTION : Nettoyage de la base de données en cours...")
    
    # 1. Supprimer le cache global des cartes
    result_cards = cards_collection.delete_many({})
    print(f"🗑️ Cartes globales supprimées : {result_cards.deleted_count}")

    # 2. Supprimer la collection de l'utilisateur
    result_user = user_cards_collection.delete_many({})
    print(f"🗑️ Cartes utilisateurs supprimées : {result_user.deleted_count}")

    # 3. Supprimer les Decks et Dossiers (Recommandé car les decks contiennent d'anciens IDs)
    result_items = items_collection.delete_many({})
    print(f"🗑️ Decks et Dossiers supprimés : {result_items.deleted_count}")

    print("✅ Base de données remise à zéro ! Tu es prêt pour la V2.")

if __name__ == "__main__":
    confirm = input("Es-tu sûr de vouloir tout supprimer ? (o/N) : ")
    if confirm.lower() == 'o':
        reset_database()
    else:
        print("Annulé.")