from passlib.context import CryptContext

# Configuration du hashage avec Argon2
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)

def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Vérification mot de passe échouée : {e}")
        return False

def needs_rehash(hashed_password: str) -> bool:
    return pwd_context.needs_update(hashed_password)
