# Résumé Complet du Projet "All Scans"

## Vue d'ensemble
Ce projet est une application full-stack pour la gestion de cartes à collectionner (probablement Magic: The Gathering, vu les références à Scryfall). Il comprend un backend API en Python avec FastAPI, une base de données MongoDB, et un frontend en React. L'application est conteneurisée avec Docker et orchestrée via Docker Compose.

## Outils et Technologies Utilisés

### Conteneurisation et Orchestration
- **Docker** : Conteneurisation des services backend, frontend et base de données
- **Docker Compose** : Orchestration des conteneurs avec configuration des volumes, ports et dépendances

### Backend
- **Python 3.10** : Langage principal
- **FastAPI** : Framework web pour l'API REST
- **Uvicorn** : Serveur ASGI pour FastAPI
- **PyMongo** : Driver MongoDB pour Python
- **Pydantic** : Validation et sérialisation des données
- **PassLib avec bcrypt** : Hachage des mots de passe
- **Argon2-cffi** : Alternative de hachage
- **HTTPX** : Client HTTP asynchrone
- **Python-multipart** : Gestion des formulaires multipart
- **Requests** : Bibliothèque HTTP

### Base de Données
- **MongoDB** : Base de données NoSQL pour le stockage des données

### Frontend
- **React 19.1.1** : Bibliothèque JavaScript pour l'interface utilisateur
- **React Router DOM 7.9.2** : Routage côté client
- **Framer Motion 12.23.22** : Animations et transitions
- **React Window 2.2.3** : Virtualisation pour les listes longues
- **React Window Infinite Loader 2.0.0** : Chargement infini pour les grilles
- **Create React App** : Outil de génération et build
- **Testing Library** : Tests unitaires et d'intégration
- **Web Vitals** : Mesure des performances

### Développement et Tests
- **Pytest** : Framework de tests pour Python (présent dans les tests backend)
- **ESLint** : Linting pour JavaScript/React
- **Git** : Contrôle de version (présence de .gitignore)

## Structure du Projet

```
all_scans/
├── docker-compose.yml          # Configuration Docker Compose
├── TestImport.txt              # Fichier de test d'import
├── backend/                    # Code backend Python
│   ├── Dockerfile              # Configuration Docker backend
│   ├── main.py                 # Point d'entrée FastAPI
│   ├── requirements.txt        # Dépendances Python
│   ├── run_tests.bat           # Script de lancement des tests
│   ├── database.py             # Configuration base de données
│   ├── models/                 # Modèles de données Pydantic
│   │   ├── user.py
│   │   ├── card.py
│   │   ├── user_card.py
│   │   ├── item.py
│   │   └── dossier.py
│   ├── routes/                 # Routes API FastAPI
│   │   ├── auth_routes.py
│   │   ├── user_routes.py
│   │   ├── card_routes.py
│   │   ├── user_card_routes.py
│   │   └── item_routes.py
│   ├── tests/                  # Tests unitaires
│   │   ├── test_import_performance.py
│   │   ├── test_user_cards.py
│   │   └── README.md
│   └── utils/                  # Utilitaires
│       └── passwords.py
├── frontend/                   # Application React
│   ├── Dockerfile              # Configuration Docker frontend
│   ├── package.json            # Dépendances et scripts npm
│   ├── README.md
│   ├── public/                 # Assets statiques
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/                    # Code source React
│   │   ├── App.js              # Composant principal
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── index.css
│   │   ├── reportWebVitals.js
│   │   ├── setupTests.js
│   │   └── components/         # Composants React
│   │       ├── CardsList.js
│   │       ├── CardSearchBar.js
│   │       ├── MyCardSearchBar.js
│   │       ├── CardDetails.js
│   │       ├── CardGrid.js
│   │       ├── CardModal.js
│   │       ├── CardSearchDetailModal.js
│   │       ├── ImportModal.js
│   │       ├── ItemsPage.js
│   │       ├── ListDetails.js
│   │       ├── LoginPage.js
│   │       ├── RegisterPage.js
│   │       ├── ProtectedRoute.js
│   │       └── VirtualizedCardGrid.js
│   └── build/                  # Build de production
│       ├── index.html
│       ├── asset-manifest.json
│       ├── manifest.json
│       ├── robots.txt
│       └── static/
│           ├── css/
│           └── js/
```

## Points Clés du Projet

### Architecture
- **Microservices** : Séparation claire entre backend, frontend et base de données
- **API REST** : Communication entre frontend et backend via HTTP
- **Authentification par sessions** : Gestion des sessions utilisateur avec cookies
- **CORS configuré** : Autorisation des requêtes cross-origin pour le développement local

### Fonctionnalités Principales
- **Gestion des utilisateurs** : Inscription, connexion, déconnexion
- **Collection de cartes** : Recherche, visualisation et gestion des cartes
- **Organisation** : Système de dossiers, decks et listes pour organiser les cartes
- **Import de données** : Intégration avec l'API Scryfall pour les données de cartes
- **Interface utilisateur** : Navigation, recherche, détails des cartes avec virtualisation

### Sécurité
- **Hachage des mots de passe** : Utilisation de bcrypt pour sécuriser les mots de passe
- **Sessions sécurisées** : Gestion des sessions avec tokens
- **Validation des données** : Pydantic pour la validation côté backend

## Structures de Données

### User (Utilisateur)
```python
class User(BaseModel):
    id: str | None = None
    nom: str
    email: str
    password: str
```

### Card (Carte)
```python
class Card(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    lang: Optional[str] = None
    image_small: Optional[str] = None
    image_normal: Optional[str] = None
    image_border_crop: Optional[str] = None
    card_faces: Optional[List[Dict[str, Any]]] = None
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
```

### UserCard (Carte utilisateur)
```python
class UserCard(BaseModel):
    user_id: str
    card_id: str
    count: int = Field(default=1, ge=1)
    added_at: datetime = Field(default_factory=datetime.utcnow)
```

### Item (Élément - Dossier/Deck/Liste)
```python
class Item(BaseModel):
    id: Optional[str] = None
    user_id: str
    type: Literal["folder", "deck", "list"] = "folder"
    nom: str
    parent_id: Optional[str] = None
    image: Optional[str] = None
    cards: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Dossier (Ancien modèle de dossier)
```python
class Dossier(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    nom: str
    image: Optional[str] = None
    decks: List[str] = []
    lists: List[str] = []
    dossiers: List[str] = []
```

## Morceaux de Code Importants

### Configuration Docker Compose
```yaml
version: '3.8'

services:
  mongo-db:
    image: mongo:latest
    container_name: all-scans-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  backend:
    build: ./backend
    container_name: all-scans-backend
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://mongo-db:27017/All_scans
    depends_on:
      - mongo-db
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    container_name: all-scans-frontend
    ports:
      - "3000:3000"
    stdin_open: true
    tty: true
    environment:
      - CHOKIDAR_USEPOLLING=true
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - /app/node_modules

volumes:
  mongo-data:
```

### Point d'entrée FastAPI
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.user_routes import router as user_router
from routes.card_routes import router as card_router
from routes.auth_routes import router as auth_router
from routes.user_card_routes import router as user_card_router
from routes.item_routes import router as item_router

app = FastAPI(title="All Scans API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(user_router)
app.include_router(user_card_router)
app.include_router(card_router)
app.include_router(item_router)

@app.get("/")
def home():
    return {"message": "✅ Backend All Scans opérationnel"}
```

### Fonction d'extraction des champs de carte
```python
def extract_card_fields(card: dict) -> dict:
    result = dict(card)

    if "image_uris" in card and card.get("image_uris"):
        result["image_small"] = card["image_uris"].get("small")
        result["image_normal"] = card["image_uris"].get("normal")
        result["image_border_crop"] = card["image_uris"].get("border_crop")
    
    if not result.get("image_small") and "card_faces" in card and isinstance(card.get("card_faces"), list) and len(card.get("card_faces")) > 0:
        face0 = card["card_faces"][0]
        if face0.get("image_uris"):
            result["image_small"] = face0["image_uris"].get("small")
            result["image_normal"] = face0["image_uris"].get("normal")
            result["image_border_crop"] = face0["image_uris"].get("border_crop")

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

    if "card_faces" in card:
        result["card_faces"] = card["card_faces"]

    return result
```

### Authentification - Route d'inscription
```python
@router.post("/register")
def register_user(data: dict = Body(...)):
    nom = data.get("nom")
    email = data.get("email")
    password = data.get("password")

    if not nom or not email or not password:
        raise HTTPException(status_code=400, detail="Tous les champs sont obligatoires")

    if len(nom) > 32:
        raise HTTPException(status_code=400, detail="Le nom d'utilisateur ne peut pas dépasser 32 caractères")
    email = email.strip().lower()

    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cette adresse email est déjà enregistrée")

    hashed_password = hash_password(password)
    # ... suite de la fonction
```

### Composant Principal React (App.js)
```javascript
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Navigate } from "react-router-dom";
import "./App.css";

import CardsList from "./components/CardsList";
import CardSearchBar from "./components/CardSearchBar";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import CardDetails from "./components/CardDetails";
import ItemsPage from "./components/ItemsPage";
import ListDetails from "./components/ListDetails";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("http://localhost:8000/auth/me", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await fetch("http://localhost:8000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <Router>
      <nav className="header">
        {user ? (
          <>
            <Link to="/cards" className="item-header">Cartes</Link>
            <Link to="/items" className="item-header">Mes éléments</Link>
            <Link to="/search" className="item-header">Recherche carte</Link> 
            <Link to="/profile" className="item-header">
              Profil ({user.nom})
            </Link>
          </>
        ) : (
          <>
            <Link to="/search" className="item-header">Recherche carte</Link>
            <Link to="/login" className="item-header">Connexion</Link>
            <Link to="/register" className="item-header">Créer un compte</Link>
          </>
        )}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/search" element={<CardSearchBar />} />
        <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
        <Route path="/cards" element={<ProtectedRoute><CardsList /></ProtectedRoute>} />
        <Route path="/card/:cardId" element={<ProtectedRoute><CardDetails /></ProtectedRoute>} />
        <Route path="/items/:id" element={<ProtectedRoute><ListDetails /></ProtectedRoute>}/>
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <div style={{ padding: "20px" }}>
                <h2>Profil utilisateur</h2>
                <p><strong>Nom :</strong> {user?.nom}</p>
                <p><strong>Email :</strong> {user?.email}</p>
                <button onClick={handleLogout} style={{ marginTop: "10px" }}>
                  Déconnexion
                </button>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
```

### Dockerfile Backend
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Configuration Base de Données
```python
import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

client = MongoClient(MONGO_URI)
db = client["All_scans"]

# Collections
users_collection = db["Users"]
cards_collection = db["Cards"]
user_cards_collection = db["UserCards"]
items_collection = db["Items"]
```

### Utilitaires de Sécurité (Hachage des Mots de Passe)
```python
from passlib.context import CryptContext

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
```

## Déploiement et Exécution

### Démarrage
```bash
docker-compose up --build
```

### Services
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:8000
- **MongoDB** : localhost:27017

### Variables d'environnement
- `MONGO_URI` : URI de connexion MongoDB
- `CHOKIDAR_USEPOLLING` : Pour le hot-reload sous Windows

## Tests
- **Backend** : Tests d'intégration avec Pytest et HTTPX pour tester les endpoints API
- **Frontend** : Tests unitaires avec Testing Library (React Testing Library, Jest DOM, User Event)

### Exemple de Test Backend
```python
async def test_get_user_cards_empty_collection(base_url: str = "http://localhost:8000") -> bool:
    """
    Test la récupération d'une collection vide.
    """
    print("Test: Récupération collection vide")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/usercards")

            if response.status_code == 401:
                print("  Authentification requise (comportement attendu)")
                return True
            else:
                print(f"  Réponse inattendue: {response.status_code}")
                return False

        except Exception as e:
            print(f"  Erreur de connexion: {e}")
            return False
```

## Points d'attention
- L'application utilise des sessions en mémoire (non persistantes)
- Configuration CORS spécifique pour le développement local
- Volumes Docker pour le développement avec hot-reload
- Intégration avec l'API externe Scryfall pour les données de cartes
- Virtualisation des listes pour les performances avec de gros volumes de données</content>
<parameter name="filePath">c:\Users\polow\Desktop\Titre RNCP\all_scans\Project_Summary.md