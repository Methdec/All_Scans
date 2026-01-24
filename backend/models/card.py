from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any

# 🔹 Fonction utilitaire pour extraire les champs d'une carte reçue (ex: depuis Scryfall)
def extract_card_fields(card: dict) -> dict:
    """
    Nettoie et enrichit les données d'une carte, 
    en extrayant notamment les images et en gardant uniquement les champs utiles.
    """
    result = dict(card)

    # Ajoute image_small et image_normal si image_uris existe
    if "image_uris" in card and card.get("image_uris"):
        result["image_small"] = card["image_uris"].get("small")
        result["image_normal"] = card["image_uris"].get("normal")
        result["image_border_crop"] = card["image_uris"].get("border_crop")
    
    # Si image_uris n'a pas d'URL à top-level, vérifier card_faces pour les images et autres champs
    if not result.get("image_small") and "card_faces" in card and isinstance(card.get("card_faces"), list) and len(card.get("card_faces")) > 0:
        face0 = card["card_faces"][0]
        if face0.get("image_uris"):
            result["image_small"] = face0["image_uris"].get("small")
            result["image_normal"] = face0["image_uris"].get("normal")
            result["image_border_crop"] = face0["image_uris"].get("border_crop")

        # Remplir les autres champs depuis la première face si manquants au top-level
        def _fill_if_missing(key, src_dict, dst=result):
            if not dst.get(key) and src_dict.get(key):
                dst[key] = src_dict.get(key)

        _fill_if_missing("mana_cost", face0)
        _fill_if_missing("type_line", face0)
        _fill_if_missing("oracle_text", face0)
        _fill_if_missing("power", face0)
        _fill_if_missing("toughness", face0)
        _fill_if_missing("artist", face0)
        _fill_if_missing("flavor_text", face0)

    # Stocker card_faces complet pour les cartes multi-faces
    if "card_faces" in card:
        result["card_faces"] = card["card_faces"]

    return result


# 🔹 Modèle principal Pydantic pour une carte
class Card(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    lang: Optional[str] = None
    image_small: Optional[str] = None  # image_uris['small']
    image_normal: Optional[str] = None # image_uris['normal']
    image_border_crop: Optional[str] = None # image_uris['border_crop']
    card_faces: Optional[List[Dict[str, Any]]] = None  # Pour les cartes multi-faces
    mana_cost: Optional[str] = None
    cmc: Optional[int] = None
    type_line: Optional[str] = None
    oracle_text: Optional[str] = None
    power: Optional[str] = None
    toughness: Optional[str] = None
    colors: Optional[List[str]] = None
    color_identity: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    legalities: Optional[Dict[str, Any]] = None
    promo: Optional[bool] = None
    rarity: Optional[str] = None
    artist: Optional[str] = None
    flavor_text: Optional[str] = None
    game_changer: Optional[bool] = None
    set_name: Optional[str] = None
    rulings_uri: Optional[str] = None
    full_art: Optional[bool] = None
    prices: Optional[Dict[str, Any]] = None


# 🔹 Convertit un dictionnaire MongoDB/Scryfall en modèle Card
def card_from_dict(data: dict) -> Card:
    """
    Transforme un dictionnaire (ex: document MongoDB ou JSON d'API)
    en instance Pydantic Card propre.
    """
    return Card(
        id=data.get("id"),
        name=data.get("name"),
        lang=data.get("lang"),  
        image_small=data.get("image_small"),
        image_normal=data.get("image_normal"),
        image_border_crop=data.get("image_border_crop"),
        card_faces=data.get("card_faces"),
        mana_cost=data.get("mana_cost"),
        cmc=int(data["cmc"]) if "cmc" in data and data["cmc"] is not None else None,
        type_line=data.get("type_line"),
        oracle_text=data.get("oracle_text"),
        power=data.get("power"),
        toughness=data.get("toughness"),
        colors=data.get("colors"),
        color_identity=data.get("color_identity"),
        keywords=data.get("keywords"),
        legalities=data.get("legalities"),
        promo=data.get("promo"),
        rarity=data.get("rarity"),
        artist=data.get("artist"),
        flavor_text=data.get("flavor_text"),
        game_changer=data.get("game_changer"),
        set_name=data.get("set_name"),
        rulings_uri=data.get("rulings_uri"),
        full_art=data.get("full_art"),
        prices=data.get("prices"),
    )
