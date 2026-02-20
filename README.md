# All Scans - MTG Collection Manager

**All Scans** est une application Fullstack complète permettant aux joueurs de *Magic: The Gathering* de gérer leur collection physique, de construire des decks et d'analyser leurs statistiques.

Le projet est conçu autour d'une architecture **3-Tiers** moderne, séparant une interface réactive (React) d'une API performante (FastAPI) et d'une base de données flexible (MongoDB).

---

## Fonctionnalités Principales

* **Gestion de Collection** : Import massif, recherche filtrée, gestion des quantités et états.
* **Deckbuilder Intelligent** :
    * Création de decks (Commander, Standard, etc.).
    * **Auto-Balance** : Calcul automatique de la base de mana (Terrains) selon la couleur des cartes.
    * Distinction entre decks **Virtuels** (Listes) et **Construits** (Physiques).
* **Données Riches** : Synchronisation avec l'API **Scryfall** (Prix, Images, Textes Oracle).
* **Sécurité** : Authentification robuste via **Argon2** et **Cookies de Session HttpOnly**.

---

## Stack Technique

| Domaine | Technologies |
| :--- | :--- |
| **Frontend** | React.js, React Router, Recharts, CSS Modules |
| **Backend** | FastAPI (Python), Uvicorn, Pydantic |
| **Data** | MongoDB (NoSQL), Motor (Driver Async) |
| **Sécurité** | Argon2 (Hashing), HTTPX (Async Client) |

Pour plus de détails techniques, consultez le fichier [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Guide de Démarrage (Quick Start)

Pour lancer le projet, vous devez exécuter le **Backend** et le **Frontend** dans deux terminaux séparés.

### Prérequis
* **Node.js** (v16+)
* **Python** (v3.9+)
* **MongoDB** (Doit être lancé localement sur le port `27017`)

### 1️Terminal 1 : Lancer le Backend (API)

```bash
cd backend

# Créer l'environnement virtuel (si pas déjà fait)
python -m venv venv

# Activer l'environnement
# Windows :
.\venv\Scripts\activate
# Mac/Linux :
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
uvicorn main:app --reload