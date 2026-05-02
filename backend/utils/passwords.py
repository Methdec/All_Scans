from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import re

# Initialisation du hasher Argon2 natif (Plus besoin de passlib !)
ph = PasswordHasher()

def hash_password(plain_password: str) -> str:
    """Hache le mot de passe avec Argon2id."""
    return ph.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie si le mot de passe correspond au hash."""
    try:
        # La fonction verify de la librairie native renvoie True si c'est bon, 
        # mais lève une exception VerifyMismatchError si c'est faux.
        ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError:
        # Mot de passe incorrect
        return False
    except Exception as e:
        # Autre erreur (ex: hash corrompu)
        print(f"Erreur inattendue de vérification : {e}")
        return False

def needs_rehash(hashed_password: str) -> bool:
    """Vérifie si le hash a besoin d'être mis à jour avec de nouveaux paramètres de sécurité."""
    return ph.check_needs_rehash(hashed_password)

def validate_password_strength(password: str) -> dict:
    """
    Vérifie la robustesse d'un mot de passe et renvoie un dictionnaire
    avec un statut de validité et un message d'erreur si nécessaire.
    """
    if len(password) < 8:
        return {"valid": False, "message": "Le mot de passe doit contenir au moins 8 caractères."}
    
    if not re.search(r"[A-Z]", password):
        return {"valid": False, "message": "Le mot de passe doit contenir au moins une lettre majuscule."}
    
    if not re.search(r"[a-z]", password):
        return {"valid": False, "message": "Le mot de passe doit contenir au moins une lettre minuscule."}
    
    if not re.search(r"\d", password):
        return {"valid": False, "message": "Le mot de passe doit contenir au moins un chiffre."}
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return {"valid": False, "message": "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)"}
        
    return {"valid": True, "message": "Mot de passe valide."}