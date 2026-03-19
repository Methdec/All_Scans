from database import user_cards_collection

def fix_mongodb_indexes():
    print("Verification des index de la collection UserCards...")
    
    # 1. Recuperation de tous les index existants
    indexes = user_cards_collection.index_information()
    
    # 2. On cherche l'index problematique (souvent nomme "user_id_1_card_id_1")
    index_to_drop = None
    for index_name, info in indexes.items():
        keys = info.get('key', [])
        # Si l'index est basé uniquement sur user_id et card_id
        if len(keys) == 2 and keys[0][0] == 'user_id' and keys[1][0] == 'card_id':
            index_to_drop = index_name
            break

    # 3. Suppression de l'ancien index
    if index_to_drop:
        print(f"Index problematique trouve : {index_to_drop}. Suppression en cours...")
        user_cards_collection.drop_index(index_to_drop)
        print("Ancien index supprime avec succes.")
    else:
        print("Aucun ancien index bloquant trouve.")

    # 4. Creation du NOUVEL index qui inclut la notion de Foil
    try:
        print("Creation du nouvel index (user_id + card_id + is_foil)...")
        user_cards_collection.create_index(
            [("user_id", 1), ("card_id", 1), ("is_foil", 1)], 
            unique=True,
            name="user_card_foil_unique"
        )
        print("Nouvel index cree avec succes ! Le probleme est resolu.")
    except Exception as e:
        print(f"Erreur lors de la creation du nouvel index : {e}")

if __name__ == "__main__":
    fix_mongodb_indexes()