# reset_db.py
from database import cards_collection, user_cards_collection, items_collection, history_collection
# Importe 'users_collection' si tu l'as definie dans ton fichier database.py
# from database import users_collection 

def reset_database():
    print("ATTENTION : Nettoyage des donnees en cours...")
    
    # 1. Vider le cache global des cartes
    result_cards = cards_collection.delete_many({})
    print(f"Cartes globales supprimees : {result_cards.deleted_count}")

    # 2. Vider la collection physique de l'utilisateur
    result_user = user_cards_collection.delete_many({})
    print(f"Cartes utilisateurs supprimees : {result_user.deleted_count}")

    # 3. Vider les Decks et Dossiers
    result_items = items_collection.delete_many({})
    print(f"Decks et Dossiers supprimes : {result_items.deleted_count}")

    # 4. Vider l'historique des actions
    result_history = history_collection.delete_many({})
    print(f"Historique des actions supprime : {result_history.deleted_count}")

    # 5. Vider les utilisateurs (Decommenter si necessaire)
    # result_users = users_collection.delete_many({})
    # print(f"Utilisateurs supprimes : {result_users.deleted_count}")

    print("\nOperation terminee. Les collections sont vides mais l'architecture et les index sont intacts.")

if __name__ == "__main__":
    confirm = input("Es-tu certain de vouloir vider toutes les donnees des collections ? (o/N) : ")
    if confirm.lower() == 'o':
        reset_database()
    else:
        print("Operation annulee.")