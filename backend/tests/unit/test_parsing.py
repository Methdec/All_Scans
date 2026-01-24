import pytest
# Assure-toi que l'import pointe vers le bon fichier.
# Si tu as déplacé la fonction dans utils, change l'import !
from routes.user_card_routes import parse_import_line

class TestParsing:

    def test_basic_quantity_name(self):
        """Test: '4 Lightning Bolt'"""
        line = "4 Lightning Bolt"
        result = parse_import_line(line)
        
        assert result is not None
        assert result["quantity"] == 4
        assert result["name"] == "Lightning Bolt"
        assert result["set"] is None

    def test_quantity_with_x(self):
        """Test: '4x Lightning Bolt'"""
        line = "4x Lightning Bolt"
        result = parse_import_line(line)
        
        assert result["quantity"] == 4
        assert result["name"] == "Lightning Bolt"

    def test_full_format_arena(self):
        """Test: '2 Crystal Grotto (WOE) 254'"""
        line = "2 Crystal Grotto (WOE) 254"
        result = parse_import_line(line)
        
        assert result["quantity"] == 2
        assert result["name"] == "Crystal Grotto"
        assert result["set"] == "woe" # Ta fonction convertit en lower()
        assert result["collector_number"] == "254"

    def test_full_format_with_variant_cn(self):
        """Test: '1 Sheoldred, the Apocalypse (DMU) 107a'"""
        line = "1 Sheoldred, the Apocalypse (DMU) 107a"
        result = parse_import_line(line)
        
        assert result["quantity"] == 1
        assert result["name"] == "Sheoldred, the Apocalypse"
        assert result["set"] == "dmu"
        assert result["collector_number"] == "107a"

    def test_fallback_simple_name(self):
        """Test: 'Sol Ring' (Pas de quantité explicite)"""
        line = "Sol Ring"
        result = parse_import_line(line)
        
        assert result["quantity"] == 1
        assert result["name"] == "Sol Ring"

    def test_empty_line(self):
        """Test: Ligne vide ou espaces"""
        assert parse_import_line("") is None
        assert parse_import_line("   ") is None