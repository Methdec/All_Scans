# Plan de Test - All Scans

Ce document détaille la stratégie de validation de l'application **All Scans**. Il couvre les tests automatisés (Backend) et les tests fonctionnels manuels (Frontend).

L'objectif est de garantir la fiabilité des imports, la sécurité des données utilisateurs et la performance des recherches.

---

## 1. Environnement de Test

Les tests sont exécutés dans un environnement isolé pour ne jamais impacter les données de production.

* **Framework de test** : `Pytest`
* **Base de Données** : MongoDB (Instance locale)
* **Isolation** : Utilisation d'une base dédiée `All_scans_TEST` (créée et détruite automatiquement via `conftest.py`).
* **Client HTTP** : `TestClient` (FastAPI) pour simuler les requêtes API sans lancer le serveur.

---

## 2. Cartographie des Tests Automatisés

Les scripts de tests sont situés dans le dossier `backend/tests/` et sont organisés par typologie.

### A. Tests Unitaires (`/tests/unit`)
*Validation des fonctions logiques isolées, sans dépendance à la base de données ou au réseau.*

| Fichier | Fonctionnalité testée | Scénarios Clés |
| :--- | :--- | :--- |
| **`test_card_extraction.py`** | **Transformation Scryfall** | • Extraction des champs essentiels (ID, Image, Rareté).<br>• Gestion des données manquantes (Power/Toughness).<br>• Vérification des légalités (Commander/Vintage). |
| **`test_import_parsing.py`** | **Parsing d'Import** | • Reconnaissance format simple (`4 Lightning Bolt`).<br>• Reconnaissance format Arena (`2 Crystal Grotto (WOE) 254`).<br>• Gestion des lignes vides et espaces. |

### B. Tests d'Intégration (`/tests/integration`)
*Validation des flux complets API <-> Base de Données.*

| Fichier | Flux testé | Scénarios Clés |
| :--- | :--- | :--- |
| **`test_auth_flow.py`** | **Authentification** | • Cycle complet : Inscription ➔ Connexion ➔ Cookie Session ➔ Accès `/me`.<br>• Vérification des refus d'accès sans cookie. |
| **`test_card_crud.py`** | **Gestion Collection** | • **C**reate : Ajout d'une carte.<br>• **R**ead : Recherche filtrée.<br>• **U**pdate : Modification quantité.<br>• **D**elete : Suppression de l'inventaire. |
| **`test_deck_flow.py`** | **Deckbuilding** | • Création d'un deck Commander.<br>• Ajout multiple de cartes (gestion des doublons).<br>• Suppression partielle (décrémentation) et totale. |

### C. Tests de Performance (`/tests/performance`)
*Validation des temps de réponse et de la tenue en charge.*

| Fichier | Objectif | Critères d'acceptation (KPI) |
| :--- | :--- | :--- |
| **`test_db_search_perf.py`** | **Recherche BDD** | • Insertion de 2000 cartes simulées.<br>• Recherche filtrée complexe (Couleur + Type).<br>**Cible : < 200ms** |
| **`test_scryfall_perf.py`** | **API Externe** | • Temps de réponse unitaire sur Scryfall.<br>• Test de charge (Batch) en asynchrone (5 requêtes simultanées).<br>**Cible : < 2.0s** |

---

## 3. Scénarios de Test Fonctionnels (Manuel / UI)

Ces tests valident l'expérience utilisateur finale sur le Frontend (React).

### A. Interface Utilisateur
| ID | Fonctionnalité | Action | Résultat Attendu |
| :--- | :--- | :--- | :--- |
| **UI-01** | **Navigation** | Cliquer sur un dossier puis utiliser le fil d'ariane. | L'URL change et la vue remonte au dossier parent. |
| **UI-02** | **Modale Carte** | Cliquer sur une carte dans la bibliothèque. | Affichage correct du prix, du set et de l'état (Foil/Normal). |
| **UI-03** | **Feedback** | Ajouter une carte à un deck. | Notification visuelle ("Toast") de succès. |

### B. Logique Métier Visuelle
| ID | Fonctionnalité | Action | Résultat Attendu |
| :--- | :--- | :--- | :--- |
| **BIZ-01** | **Auto-Balance** | Dans un deck Bleu/Rouge, cliquer sur "Équilibrer". | Le graphique de mana se met à jour, des *Islands* et *Mountains* sont ajoutées. |
| **BIZ-02** | **Validation** | Créer un deck de 99 cartes en Commander. | Un badge d'avertissement indique que le deck est illégal (100 cartes requises). |

---

## 4. Exécution des Tests

### Prérequis
* Python installé avec les dépendances (`pip install -r requirements.txt`).
* MongoDB lancé localement.

### Lancer tous les tests automatisés
À la racine du dossier `backend/` :

```bash
pytest