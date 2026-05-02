from datetime import datetime

def evaluate_condition(card: dict, condition: dict) -> bool:
    field = condition.get("field")
    operator = condition.get("operator")
    val_str = condition.get("value", "")
    
    # 1. Champs Textuels
    if field in ["type_line", "oracle_text", "name", "set"]:
        card_val = str(card.get(field, "")).lower()
        search_val = str(val_str).lower()
        
        if operator == "contains":
            return search_val in card_val
        elif operator == "not_contains":
            return search_val not in card_val
        elif operator == "equals":
            return card_val == search_val
        elif operator == "is_empty":
            return not card_val
            
    # 2. Champs Numériques (y compris Force et Endurance qui peuvent être des lettres comme '*')
    elif field in ["cmc", "power", "toughness", "price"]:
        try:
            # Gestion spéciale du prix (on prend le prix EUR par défaut, ou USD s'il n'y a pas d'EUR)
            if field == "price":
                prices = card.get("prices", {})
                card_val_float = float(prices.get("eur") or prices.get("usd") or 0.0)
            else:
                card_val_float = float(card.get(field, 0.0))
                
            search_val_float = float(val_str)
            
            if operator == "==":
                return card_val_float == search_val_float
            elif operator == ">":
                return card_val_float > search_val_float
            elif operator == "<":
                return card_val_float < search_val_float
        except (ValueError, TypeError):
            # Si on essaie de comparer "X" ou "*" avec un nombre
            return False

    # 3. Champs de Couleurs
    elif field in ["color_exact", "color_approx"]:
        card_colors = set(card.get("colors", []))
        search_colors = set([c.strip().upper() for c in val_str.split(",") if c.strip()])
        
        # Gestion spéciale de l'incolore ("C")
        if "C" in search_colors:
            if field == "color_exact":
                return len(card_colors) == 0
            elif field == "color_approx":
                return True # Toute carte incolore est une subset d'une autre

        if field == "color_exact":
            return card_colors == search_colors
        elif field == "color_approx":
            # La carte doit seulement contenir des couleurs permises (subset)
            return card_colors.issubset(search_colors)

    # 4. Champs de Date
    elif field == "date_added":
        card_date_str = card.get("released_at", "") # On utilise released_at comme ref temporelle de la carte
        if not card_date_str:
            return False
            
        try:
            # Format Scryfall standard "YYYY-MM-DD"
            card_date = datetime.strptime(card_date_str, "%Y-%m-%d")
            search_date = datetime.strptime(val_str, "%Y-%m-%d")
            
            if operator == "==":
                return card_date.date() == search_date.date()
            elif operator == ">":
                return card_date > search_date
            elif operator == "<":
                return card_date < search_date
        except ValueError:
            return False
            
    return False


def get_automated_tags(card_data: dict, rules: list) -> list:
    """
    Parcourt toutes les règles de l'utilisateur et renvoie la liste des tags applicables à cette carte.
    """
    applied_tags = []
    
    for rule in rules:
        conditions = rule.get("conditions", [])
        logic = rule.get("logic", "AND")
        tag_name = rule.get("tag_name", "").strip().lower()
        
        if not conditions or not tag_name:
            continue
            
        if logic == "OR":
            # Si UNE SEULE condition est vraie, on applique le tag
            rule_passed = any(evaluate_condition(card_data, cond) for cond in conditions)
        else:
            # Sinon (AND), TOUTES les conditions doivent être vraies
            rule_passed = all(evaluate_condition(card_data, cond) for cond in conditions)
            
        if rule_passed and tag_name not in applied_tags:
            applied_tags.append(tag_name)
            
    return applied_tags