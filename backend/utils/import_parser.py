import re

def parse_mtg_line(line: str):
    """
    Analyse une ligne de texte de decklist MTG et extrait les informations.
    Supporte les formats Arena, MTGO, Moxfield, TCGPlayer, etc.
    """
    line = line.strip()
    if not line:
        return None

    is_foil = False
    is_sideboard = False
    is_commander = False

    # 1. Detection Sideboard / Commander en debut de ligne
    if re.match(r"^SB:\s+", line, flags=re.IGNORECASE):
        is_sideboard = True
        line = re.sub(r"^SB:\s+", "", line, flags=re.IGNORECASE).strip()
    elif re.match(r"^CMDR:\s+", line, flags=re.IGNORECASE):
        is_commander = True
        line = re.sub(r"^CMDR:\s+", "", line, flags=re.IGNORECASE).strip()

    # 2. NOUVEAU : Nettoyage des balises de zone en fin de ligne (ex: "(Principal)", "(Sideboard)")
    # Cela permet d'importer proprement les listes exportées depuis notre propre app ou Arena
    line = re.sub(r"\s*\((?:Principal|Mainboard|Sideboard|Reserve|CMDR|Commander)\)$", "", line, flags=re.IGNORECASE).strip()

    # 3. Detection Foil
    if re.search(r"\*[FE]\*$", line, flags=re.IGNORECASE) or re.search(r"\bFoil\b", line, flags=re.IGNORECASE):
        is_foil = True
        line = re.sub(r"\*[FE]\*$", "", line, flags=re.IGNORECASE).strip()
        line = re.sub(r"\bFoil\b", "", line, flags=re.IGNORECASE).strip()

    # 4. Regex complete: "4x Lightning Bolt (LEA) 234" ou "1 Black Lotus [M14]"
    pattern_full = r"^(\d+)[xX]?\s+(.+?)\s+[\(\[]([a-zA-Z0-9]{2,5})[\)\]](?:\s+(\d+[a-zA-Z]*))?$"
    match_full = re.match(pattern_full, line)
    
    if match_full:
        return {
            "qty": int(match_full.group(1)),
            "name": match_full.group(2).strip(),
            "set": match_full.group(3).lower(),
            "collector_number": match_full.group(4) if match_full.group(4) else None,
            "is_foil": is_foil,
            "is_sideboard": is_sideboard,
            "is_commander": is_commander
        }
        
    # 5. Regex simple: "4x Lightning Bolt" ou "4 Lightning Bolt"
    pattern_simple = r"^(\d+)[xX]?\s+(.+)$"
    match_simple = re.match(pattern_simple, line)
    
    if match_simple:
        return {
            "qty": int(match_simple.group(1)),
            "name": match_simple.group(2).strip(),
            "set": None,
            "collector_number": None,
            "is_foil": is_foil,
            "is_sideboard": is_sideboard,
            "is_commander": is_commander
        }

    # 6. Cas final: Aucun chiffre (ex: "Black Lotus")
    return {
        "qty": 1,
        "name": line,
        "set": None,
        "collector_number": None,
        "is_foil": is_foil,
        "is_sideboard": is_sideboard,
        "is_commander": is_commander
    }