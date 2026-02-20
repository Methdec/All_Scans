# MTG Collection Manager - Backend API

API REST performante développée avec **FastAPI** et **MongoDB**.
Elle assure la persistance des données, la synchronisation avec Scryfall, la logique métier (calculs de mana) et la sécurité des utilisateurs.

## Stack Technique & Sécurité

Ce projet repose sur une architecture moderne :

* **Core Framework** : [FastAPI](https://fastapi.tiangolo.com/) (Python 3.8+) - Choisi pour sa rapidité et sa validation native.
* **Base de Données** : [MongoDB](https://www.mongodb.com/) - Stockage NoSQL flexible pour les objets JSON complexes (Cartes, Decks).
* **Sécurité (Auth)** :
    * **Authentification** : Session-based avec **Cookies HttpOnly** (Empêche les failles XSS, le token n'est pas accessible via JS).
    * **Hachage** : [Argon2](https://github.com/hynek/argon2-cffi) - Algorithme de hachage de pointe pour le stockage sécurisé des mots de passe.
    * **CORS** : Configuration stricte autorisant uniquement le frontend local (`localhost:3000`) avec support des credentials.
* **External API** : [HTTPX](https://www.python-httpx.org/) - Client HTTP asynchrone pour interroger l'API Scryfall sans bloquer le serveur.

---

## Quick Start (Démarrage "Exécutable")

Prérequis : **Python 3.8+** et **MongoDB** (lancé localement sur le port 27017).

Copiez-collez le bloc correspondant à votre système dans votre terminal pour installer et lancer le projet en une fois :

### Windows (PowerShell)
```powershell
# 1. Création de l'environnement virtuel
python -m venv venv

# 2. Activation
.\venv\Scripts\activate

# 3. Installation des dépendances (FastAPI, Uvicorn, Motor, Argon2...)
pip install -r requirements.txt

# 4. (Optionnel) Réinitialiser la base de données (Attention : Supprime tout !)
# python reset_db.py

# 5. Lancer le serveur de développement
uvicorn main:app --reload