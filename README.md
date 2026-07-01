# All Scans - Gestionnaire de Collection Magic: The Gathering

**All Scans** est une application web complète (3-tier) destinée aux joueurs et collectionneurs de Magic: The Gathering. Elle permet de rechercher des cartes, de gérer sa collection personnelle, de construire des decks validés selon les règles officielles des formats, et s'interface avec un scanner de cartes physique basé sur un ESP32.

---

## 1. Fonctionnalités Principales

- **Recherche Avancée (Scryfall) :** Intégration complète de l'API Scryfall pour rechercher des cartes par nom, couleur, type, rareté et vérifier leur légalité selon les formats (Standard, Commander, Modern, etc.).
- **Gestion de Decks :**
  - Création, duplication et organisation de decks dans des dossiers.
  - Validation algorithmique des decks (respect de la règle des 4 exemplaires, contraintes de 100 cartes pour le Commander, etc.).
  - Statistiques visuelles de répartition de mana et de types de cartes.
- **Collection Personnelle :** Ajout de cartes à une collection locale pour suivre sa possession réelle.
- **Module Scanner (ESP32) :** Infrastructure réseau (mDNS, requêtes CORS) préparée pour recevoir et traiter les scans provenant d'un module matériel externe développé en C++.

---

## 2. Architecture et Technologies

Le projet est divisé en trois environnements distincts communicant via des API REST.

| Composant | Technologie | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18.2 | Interface utilisateur Single Page Application (SPA). Utilise React Router pour la navigation et Recharts pour les graphiques. |
| **Backend** | FastAPI 0.117 | API REST asynchrone en Python. Gère la logique métier, la validation de données avec Pydantic et l'authentification (Argon2 / JWT). |
| **Base de Données** | MongoDB 4.4 | Base de données NoSQL orientée documents (accès via PyMongo) stockant les utilisateurs, les collections et les decks. |
| **Matériel** | ESP32 (C++) | Code embarqué gérant un portail captif Wi-Fi et un serveur HTTP léger pour l'envoi de requêtes vers l'application. |

---

## 3. Structure du Projet

```
All_Scans/
├── backend/                   # Code source du serveur API
│   ├── main.py                # Point d'entrée de l'API FastAPI
│   ├── database.py            # Connexion au client MongoDB
│   ├── models/                # Schémas de données Pydantic
│   ├── routes/                # Contrôleurs et endpoints (auth, decks, cards)
│   └── utils/                 # Logique métier (validation de decks, hachage)
├── frontend/                  # Code source de l'application React
│   ├── public/                # Fichiers statiques
│   └── src/
│       ├── App.js             # Routage principal
│       ├── components/        # Composants d'interface (Modales, Grilles, etc.)
│       ├── theme.css          # Styles globaux
│       └── utils/             # Fonctions utilitaires et appels API
└── ScannerESP32/              # Code source du micrologiciel matériel
    └── ScannerESP32.ino       # Script C++ (Arduino IDE)
```

---

## 4. Installation et Lancement (Environnement de Développement)

Pour exécuter ce projet localement sans utiliser de conteneurs, vous devez disposer de **Node.js**, **Python 3.10+** et d'une instance **MongoDB** en cours d'exécution sur le port 27017.

### Étape 1 : Configuration de la Base de Données

Assurez-vous que votre service MongoDB local est actif.

L'URI par défaut attendue par le backend est :
```
mongodb://localhost:27017
```

La base de données sera nommée automatiquement : `All_scans`

### Étape 2 : Lancement du Backend (FastAPI)

Ouvrez un terminal et naviguez dans le dossier `backend` :

```bash
cd backend
```

Créez un environnement virtuel et installez les dépendances :

```bash
python -m venv venv
source venv/bin/activate  # Sur Windows : venv\Scripts\activate
pip install -r requirements.txt
```

Lancez le serveur de développement :

```bash
uvicorn main:app --reload --port 8000
```

L'API est désormais accessible sur `http://localhost:8000`. Vous pouvez consulter la documentation interactive Swagger sur `http://localhost:8000/docs`.

### Étape 3 : Lancement du Frontend (React)

Ouvrez un nouveau terminal et naviguez dans le dossier `frontend` :

```bash
cd frontend
```

Installez les dépendances JavaScript :

```bash
npm install
```

Lancez l'application client :

```bash
npm start
```

Le Frontend s'ouvrira automatiquement dans votre navigateur à l'adresse `http://localhost:3000`.

### Étape 4 : Configuration de l'Adresse IP (accès réseau local)

Si vous souhaitez accéder à l'application depuis un autre appareil sur votre réseau local (smartphone, tablette, ou le module ESP32), vous devez déclarer votre adresse IP locale à deux endroits :

1. **Frontend — `frontend/src/utils/api.js`**

   Modifiez la constante `API_BASE_URL` avec votre adresse IP locale (celle de la machine qui fait tourner le backend) :

   ```js
   // src/utils/api.js

   // L'URL de base du backend.
   export const API_BASE_URL = "http://X.X.X.X:8000";
   ```

2. **Backend — `backend/main.py`**

   Ajoutez cette même adresse IP (avec le port `3000` du frontend) à la liste `allow_origins` du middleware CORS :

   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=[
           "http://localhost:3000"# ajoutez votre IP ici
       ],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

> ⚠️ Sans cette configuration, les requêtes émises depuis un autre appareil que `localhost` seront bloquées par la politique CORS du backend. Pensez à mettre à jour ces deux fichiers à chaque changement de réseau (IP différente selon le lieu : maison, bureau, etc.).

---

## 5. Sécurité

- **Mots de passe :** Hachés et salés via l'algorithme Argon2id.
- **Sessions :** Sécurisées par des JSON Web Tokens (JWT) avec expiration.
- **CORS :** Le backend est configuré pour n'accepter que les requêtes provenant de l'interface client définie.
