from pydantic import BaseModel
from typing import List, Optional, Dict, Any

def extract_card_fields(scryfall_data: dict) -> dict:
    # 1. Gestion des faces
    image_normal = scryfall_data.get("image_uris", {}).get("normal")
    image_small = scryfall_data.get("image_uris", {}).get("small")
    image_border_crop = scryfall_data.get("image_uris", {}).get("border_crop")
    image_art_crop = scryfall_data.get("image_uris", {}).get("art_crop") # NOUVEAU
    
    mana_cost = scryfall_data.get("mana_cost", "")
    oracle_text = scryfall_data.get("oracle_text", "")
    type_line = scryfall_data.get("type_line", "")
    power = scryfall_data.get("power", "")
    toughness = scryfall_data.get("toughness", "")

    # Faces multiples
    if not image_normal and "card_faces" in scryfall_data:
        face0 = scryfall_data["card_faces"][0]
        image_normal = face0.get("image_uris", {}).get("normal")
        image_small = face0.get("image_uris", {}).get("small")
        image_border_crop = face0.get("image_uris", {}).get("border_crop")
        image_art_crop = face0.get("image_uris", {}).get("art_crop") # NOUVEAU
        
        mana_cost = face0.get("mana_cost", "")
        oracle_text = face0.get("oracle_text", "")
        type_line = face0.get("type_line", "")
        power = face0.get("power", "")
        toughness = face0.get("toughness", "")
        
        if "colors" not in scryfall_data:
            scryfall_data["colors"] = face0.get("colors", [])

    # 2. Prix
    raw_prices = scryfall_data.get("prices", {})
    def safe_float(val):
        try:
            return float(val) if val else 0.0
        except:
            return 0.0

    prices = {
        "usd": safe_float(raw_prices.get("usd")),
        "eur": safe_float(raw_prices.get("eur")),
        "tix": safe_float(raw_prices.get("tix"))
    }

    purchase_uris = scryfall_data.get("purchase_uris", {})

    # 3. Retour
    return {
        "id": scryfall_data.get("id"),
        "oracle_id": scryfall_data.get("oracle_id"),
        "name": scryfall_data.get("name"),
        "lang": scryfall_data.get("lang", "en"),
        "set": scryfall_data.get("set"),
        "set_name": scryfall_data.get("set_name"),
        "collector_number": scryfall_data.get("collector_number"),
        
        "image_small": image_small,
        "image_normal": image_normal,
        "image_border_crop": image_border_crop,
        "image_art_crop": image_art_crop, # NOUVEAU
        
        "mana_cost": mana_cost,
        "cmc": scryfall_data.get("cmc", 0.0),
        "type_line": type_line,
        "oracle_text": oracle_text,
        "colors": scryfall_data.get("colors", []),
        "color_identity": scryfall_data.get("color_identity", []),
        "keywords": scryfall_data.get("keywords", []),
        "power": power,
        "toughness": toughness,
        
        "rarity": scryfall_data.get("rarity"),
        "legalities": scryfall_data.get("legalities", {}),
        "prices": prices,
        "purchase_uris": purchase_uris,
        "reprint": scryfall_data.get("reprint", False),
        
        "card_faces": scryfall_data.get("card_faces")
    }

class Card(BaseModel):
    id: Optional[str] = None
    oracle_id: Optional[str] = None
    name: Optional[str] = None
    lang: Optional[str] = "en"
    set: Optional[str] = None
    set_name: Optional[str] = None
    collector_number: Optional[str] = None
    image_small: Optional[str] = None
    image_normal: Optional[str] = None
    image_border_crop: Optional[str] = None
    image_art_crop: Optional[str] = None # NOUVEAU
    mana_cost: Optional[str] = None
    cmc: Optional[float] = 0.0
    type_line: Optional[str] = None
    oracle_text: Optional[str] = None
    power: Optional[str] = None
    toughness: Optional[str] = None
    colors: Optional[List[str]] = []
    color_identity: Optional[List[str]] = []
    keywords: Optional[List[str]] = []
    rarity: Optional[str] = None
    legalities: Optional[Dict[str, Any]] = None
    prices: Optional[Dict[str, float]] = None
    purchase_uris: Optional[Dict[str, str]] = None
    card_faces: Optional[List[Dict[str, Any]]] = None

def card_from_dict(data: dict) -> Card:
    return Card(
        id=data.get("id"),
        oracle_id=data.get("oracle_id"),
        name=data.get("name"),
        lang=data.get("lang"),
        set=data.get("set"),
        set_name=data.get("set_name"),
        collector_number=data.get("collector_number"),
        image_small=data.get("image_small"),
        image_normal=data.get("image_normal"),
        image_border_crop=data.get("image_border_crop"),
        image_art_crop=data.get("image_art_crop"),
        mana_cost=data.get("mana_cost"),
        cmc=float(data.get("cmc", 0.0)),
        type_line=data.get("type_line"),
        oracle_text=data.get("oracle_text"),
        power=data.get("power"),
        toughness=data.get("toughness"),
        colors=data.get("colors", []),
        color_identity=data.get("color_identity", []),
        keywords=data.get("keywords", []),
        rarity=data.get("rarity"),
        legalities=data.get("legalities", {}),
        prices=data.get("prices", {"usd": 0.0, "eur": 0.0}),
        purchase_uris=data.get("purchase_uris", {}),
        card_faces=data.get("card_faces")
    )