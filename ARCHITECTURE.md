# Architecture du Projet "All Scans"

## Schéma Global de l'Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                             │
│              http://localhost:3000                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Components: CardList, CardGrid, AuthPages, etc.          │  │
│  │ - State Management via React Hooks                       │  │
│  │ - Routing: React Router DOM                              │  │
│  │ - Styling: CSS + Framer Motion animations                │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────────────┘
                     │
                     │ HTTP/HTTPS Requests
                     │ CORS Enabled
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                             │
│              http://localhost:8000                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API GATEWAY & MIDDLEWARE                                 │  │
│  │  - CORS Middleware (Localhost:3000)                       │  │
│  │  - Request/Response Handling                              │  │
│  │  - Authentication (JWT/Passlib)                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           ROUTES & API ENDPOINTS                           │  │
│  │                                                            │  │
│  │  /auth       → Authentification (Login/Register)          │  │
│  │  /users      → Gestion des utilisateurs                  │  │
│  │  /cards      → Catalogue de cartes                        │  │
│  │  /user-cards → Collections personnelles                   │  │
│  │  /items      → Articles/Ressources                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │          BUSINESS LOGIC & MODELS                           │  │
│  │                                                            │  │
│  │  - User (authentification, profil)                        │  │
│  │  - Card (cartes du jeu)                                   │  │
│  │  - UserCard (cartes possédées)                            │  │
│  │  - Item (articles, ressources)                            │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────────────┘
                     │
                     │ PyMongo Driver
                     │ TCP Connection (port 27017)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (MongoDB)                              │
│              mongodb://localhost:27017                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Database: "All_scans"                                     │  │
│  │                                                            │  │
│  │  Collections:                                             │  │
│  │  ├── Users        (profils utilisateurs)                 │  │
│  │  ├── Cards        (cartes disponibles)                   │  │
│  │  ├── UserCards    (collections personnelles)            │  │
│  │  └── Items        (articles/ressources)                 │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flux de Communication - Exemples Concrets

### Exemple: Authentification (Login)

#### **Frontend → Backend**
```javascript
// frontend/src/components/LoginPage.js
const handleLogin = async (email, password) => {
  const response = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const token = await response.json();
  // Sauvegarder le token pour les futures requêtes
  localStorage.setItem('token', token.access_token);
};
```

#### **Backend - Route**
```python
# backend/routes/auth_routes.py
@router.post("/login")
async def login(request: LoginRequest):
    # Chercher l'utilisateur en BD
    user = users_collection.find_one({"email": request.email})
    
    # Vérifier le mot de passe (hashé avec Argon2)
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Générer un token JWT
    access_token = create_access_token(data={"sub": user["_id"]})
    
    return {"access_token": access_token, "token_type": "bearer"}
```

#### **Database - MongoDB**
```javascript
// Collection: Users
{
  "_id": ObjectId("..."),
  "email": "user@example.com",
  "hashed_password": "$argon2id$v=19$m=65540,t=3,p=4$...", // hashé avec Argon2
  "username": "johndoe",
  "created_at": ISODate("2024-01-15")
}
```

---

### Exemple: Récupérer les Cartes

#### **Frontend → Backend**
```javascript
// frontend/src/components/CardGrid.js
useEffect(() => {
  const fetchCards = async () => {
    const response = await fetch('http://localhost:8000/cards?skip=0&limit=20', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const cards = await response.json();
    setCards(cards);
  };
  fetchCards();
}, []);
```

#### **Backend - Route**
```python
# backend/routes/card_routes.py
@router.get("/cards")
async def get_cards(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    # Récupérer les cartes avec pagination
    cards = list(cards_collection.find()
                 .skip(skip)
                 .limit(limit))
    
    # Convertir ObjectId en string pour JSON
    for card in cards:
        card["_id"] = str(card["_id"])
    
    return cards
```

#### **Database - MongoDB**
```javascript
// Collection: Cards
{
  "_id": ObjectId("..."),
  "name": "Carte Dragon",
  "rarity": "Rare",
  "attack": 8,
  "defense": 6,
  "type": "Dragon",
  "image_url": "/assets/cards/dragon.png",
  "created_at": ISODate("2024-01-01")
}
```

---

### Exemple: Ajouter une Carte à sa Collection

#### **Frontend → Backend**
```javascript
// frontend/src/components/CardDetails.js
const handleAddToCollection = async (cardId) => {
  const response = await fetch('http://localhost:8000/user-cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      card_id: cardId,
      quantity: 1
    })
  });
  
  if (response.ok) {
    alert('Carte ajoutée à la collection!');
  }
};
```

#### **Backend - Route**
```python
# backend/routes/user_card_routes.py
@router.post("/user-cards")
async def add_card_to_collection(
    user_card: UserCardCreate,
    current_user: dict = Depends(get_current_user)
):
    # Créer l'entrée dans la collection personnelle
    user_card_doc = {
        "user_id": ObjectId(current_user["_id"]),
        "card_id": ObjectId(user_card.card_id),
        "quantity": user_card.quantity,
        "added_at": datetime.now()
    }
    
    result = user_cards_collection.insert_one(user_card_doc)
    
    return {
        "message": "Carte ajoutée avec succès",
        "user_card_id": str(result.inserted_id)
    }
```

#### **Database - MongoDB**
```javascript
// Collection: UserCards
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "card_id": ObjectId("..."),
  "quantity": 1,
  "added_at": ISODate("2024-02-07")
}
```

---

## Sécurité & Authentification

```
┌─────────────────────────────────────────────────────────────────┐
│                   SECURITY FLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LOGIN                                                        │
│     Client envoie: { email, password }                          │
│                      ↓                                           │
│     Backend hash le password avec bcrypt et compare             │
│                      ↓                                           │
│     Backend crée un JWT token valable ~24h                      │
│                      ↓                                           │
│     Client reçoit: { access_token: "eyJ0eX..." }               │
│                                                                  │
│  2. AUTHENTICATED REQUESTS                                       │
│     Client envoie header: Authorization: Bearer <token>         │
│                      ↓                                           │
│     Backend vérifie le token avec JWT secret                    │
│                      ↓                                           │
│     Backend récupère l'user_id du token                        │
│                      ↓                                           │
│     Request acceptée ou rejetée (401/403)                       │
│                                                                  │
│  Technologies utilisées:                                         │
│  - bcrypt: Hashage des mots de passe                           │
│  - passlib: Gestion des mots de passe sécurisés                │
│  - JWT (PyJWT): Tokens d'authentification                      │
│  - CORS Middleware: Contrôle des origines                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structure des Fichiers Clés

```
All_Scans/
│
├── frontend/                      # Application React
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.js       # Authentification
│   │   │   ├── CardGrid.js        # Affichage des cartes
│   │   │   ├── CardDetails.js     # Détails + ajout collection
│   │   │   └── ...
│   │   ├── App.js                 # Routing principal
│   │   └── utils/
│   │       └── deckRules.js       # Logique métier
│   └── package.json               # React, React-Router, Framer Motion
│
├── backend/                       # API FastAPI
│   ├── main.py                    # Point d'entrée, configuration CORS
│   ├── database.py                # Connexion MongoDB
│   ├── routes/
│   │   ├── auth_routes.py         # POST /auth/login, /auth/register
│   │   ├── card_routes.py         # GET /cards, POST /cards
│   │   ├── user_routes.py         # GET /users/{id}, PUT /users/{id}
│   │   ├── user_card_routes.py    # POST/GET /user-cards
│   │   └── item_routes.py         # GET/POST /items
│   ├── models/
│   │   ├── user.py                # Schema User (email, password, etc)
│   │   ├── card.py                # Schema Card (name, rarity, stats)
│   │   ├── user_card.py           # Schema UserCard (relation)
│   │   └── item.py                # Schema Item
│   ├── utils/
│   │   └── passwords.py           # Fonctions hash/verify
│   ├── tests/                      # Tests unitaires & intégration
│   └── requirements.txt            # Dependencies (FastAPI, PyMongo, etc)
│
└── docker-compose.yml             # Orchéstration Docker
```

---

## Déploiement & Technologies

| Composant | Technologie | Port | Statut |
|-----------|-------------|------|--------|
| **Frontend** | React 19.1 + React Router 7.9 | 3000 | Development |
| **Backend** | FastAPI 0.117 + Uvicorn | 8000 | Development |
| **Database** | MongoDB 4.15 | 27017 | Development |
| **Container** | Docker + Docker Compose | - | Enabled |

---

## Exemple Complet: Ajouter une Nouvelle Carte

### **Étape 1: Frontend envoie la requête**
```javascript
const createCard = async (cardData) => {
  const response = await fetch('http://localhost:8000/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Carte Phénix',
      rarity: 'Ultra Rare',
      attack: 10,
      defense: 5,
      type: 'Fire'
    })
  });
  
  const newCard = await response.json();
  console.log('Carte créée:', newCard._id);
};
```

### **Étape 2: Backend traite la requête**
```python
# 1. Route reçoit la requête
@router.post("/cards")
async def create_card(
    card: CardCreate,
    current_user: dict = Depends(get_current_user)
):
    # 2. Valide les données (Pydantic)
    # 3. Ajoute un timestamp
    card_doc = {
        "name": card.name,
        "rarity": card.rarity,
        "attack": card.attack,
        "defense": card.defense,
        "type": card.type,
        "created_by": ObjectId(current_user["_id"]),
        "created_at": datetime.now()
    }
    
    # 4. Insère dans MongoDB
    result = cards_collection.insert_one(card_doc)
    
    # 5. Retourne la réponse
    return {
        "_id": str(result.inserted_id),
        **card_doc,
        "created_at": str(card_doc["created_at"])
    }
```

### **Étape 3: Database enregistre les données**
```javascript
// MongoDB: Cards Collection
{
  "_id": ObjectId("65c123abc..."),
  "name": "Carte Phénix",
  "rarity": "Ultra Rare",
  "attack": 10,
  "defense": 5,
  "type": "Fire",
  "created_by": ObjectId("user_id..."),
  "created_at": ISODate("2024-02-07T10:30:00Z")
}
```

### **Étape 4: Backend retourne la réponse au Frontend**
```json
{
  "_id": "65c123abc...",
  "name": "Carte Phénix",
  "rarity": "Ultra Rare",
  "attack": 10,
  "defense": 5,
  "type": "Fire",
  "created_at": "2024-02-07T10:30:00"
}
```

---

## Relations entre les Collections

```
Users
  ├── 1 utilisateur
  │
  └── N UserCards
        ├── reference_to: Cards
        └── reference_to: Users
  
  └── N Collections personnelles

Cards
  ├── Cartes disponibles dans le système
  └── N UserCards (possédées par les utilisateurs)

Items
  ├── Articles/Ressources
  └── Liés aux cartes ou utilisateurs (optionnel)
```

---

## Test d'une Requête (cURL)

```bash
# 1. Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "mypass123"}'

# Réponse:
# {"access_token": "eyJ0eX...", "token_type": "bearer"}

# 2. Récupérer les cartes avec le token
curl -X GET http://localhost:8000/cards?skip=0&limit=10 \
  -H "Authorization: Bearer eyJ0eX..."

# 3. Ajouter une carte à la collection
curl -X POST http://localhost:8000/user-cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eX..." \
  -d '{"card_id": "65c123abc...", "quantity": 1}'
```

---

## Résumé de l'Architecture

| Aspect | Description |
|--------|-------------|
| **Type** | Architecture 3-tier classique (Frontend/Backend/Database) |
| **Frontend** | SPA React avec routing et WebSocket support |
| **Backend** | API REST FastAPI avec Session authentication |
| **Database** | MongoDB NoSQL pour la flexibilité |
| **Communication** | HTTP/REST + WebSocket (Socket.IO) |
| **Sécurité** | CORS, Session Tokens, Argon2 password hashing |
| **Scalabilité** | Prêt pour Docker/Kubernetes via docker-compose |

