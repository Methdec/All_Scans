import pytest
from models.card import extract_card_fields

# Données simulées (Mock) d'une réponse Scryfall brute
SCRYFALL_MOCK_DATA = {
    "id": "c7180237-4461-4d70-a292-b6f7056073b2",
    "name": "Black Lotus",
    "released_at": "1993-08-05",
    "mana_cost": "{0}",
    "cmc": 0.0,
    "type_line": "Artifact",
    "oracle_text": "{T}, Sacrifice Black Lotus: Add three mana of any one color.",
    "power": None,
    "toughness": None,
    "colors": [],
    "color_identity": [],
    "keywords": [],
    "legalities": {
        "standard": "not_legal",
        "vintage": "restricted",
        "commander": "banned"
    },
    "set": "leu",
    "set_name": "Limited Edition Unlimited",
    "collector_number": "232",
    "rarity": "rare",
    "image_uris": {
        "small": "https://cards.scryfall.io/small/front/c/7/c7180237.jpg",
        "normal": "https://cards.scryfall.io/normal/front/c/7/c7180237.jpg",
        "large": "https://cards.scryfall.io/large/front/c/7/c7180237.jpg"
    }
}

class TestExtraction:

    def test_extract_basic_fields(self):
        """Vérifie que les champs essentiels sont bien extraits"""
        result = extract_card_fields(SCRYFALL_MOCK_DATA)
        
        # Vérifications basiques
        assert result["id"] == "c7180237-4461-4d70-a292-b6f7056073b2"
        assert result["name"] == "Black Lotus"
        assert result["rarity"] == "rare"
        assert result["cmc"] == 0
        
        # Vérification de l'image (Critique pour ton front)
        assert result["image_normal"] == "https://cards.scryfall.io/normal/front/c/7/c7180237.jpg"

    def test_extract_legalities(self):
        """Vérifie que les légalités sont conservées"""
        result = extract_card_fields(SCRYFALL_MOCK_DATA)
        
        assert "legalities" in result
        assert result["legalities"]["vintage"] == "restricted"
        assert result["legalities"]["commander"] == "banned"

    def test_missing_power_toughness(self):
        """Vérifie que power/toughness sont gérés même si None (pour les non-créatures)"""
        result = extract_card_fields(SCRYFALL_MOCK_DATA)
        
        # Selon ton modèle, ça peut être None ou ""
        # Adapte selon ton code réel dans models/card.py
        assert result.get("power") in [None, ""]
        assert result.get("toughness") in [None, ""]

    def test_handling_missing_images(self):
        """Simule une carte sans images (ex: placeholder)"""
        broken_data = SCRYFALL_MOCK_DATA.copy()
        del broken_data["image_uris"] # On enlève les images
        
        result = extract_card_fields(broken_data)
        
        # Doit ne pas planter et mettre None ou une string vide
        assert result.get("image_normal") is None