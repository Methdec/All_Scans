# MTG Collection Manager - Frontend

Bienvenue sur l'interface utilisateur du **Gestionnaire de Collection Magic: The Gathering**.
Cette application React permet aux joueurs de gérer leur inventaire physique, de construire des decks et d'analyser leurs statistiques de mana grâce à une interface moderne et intuitive.

## Fonctionnalités Clés

* **Gestion d'Inventaire & Recherche Avancée** : Importation de listes et moteur de recherche ultra-complet (texte d'oracle, couleurs exactes ou approximatives, opérateurs mathématiques pour la force/endurance, légalité par format).
* **Deckbuilder Avancé** : Création de decks, ajout de cartes via modales, et distinction entre decks **Virtuels** (Listes) et **Construits** (Physiques).
* **Statistiques Visuelles** : Graphiques interactifs pour la courbe de mana et la répartition des couleurs (*Recharts*).
* **Auto-Balance** : Algorithme intelligent pour calculer et ajuster automatiquement la base de mana (Terrains).
* **Navigation Fluide** : Système de dossiers hiérarchiques et fil d'ariane pour organiser les decks.

## Stack Technique

* **Framework** : React.js 18 (Create React App)
* **Routing** : React Router DOM v6
* **Graphiques** : Recharts
* **Styles** : CSS Modules & Variables CSS (Thème sombre)
* **Requêtes API** : Fetch API avec AbortController pour l'optimisation des requêtes.

## Prérequis

* [Node.js](https://nodejs.org/) (version 18 recommandée) si exécution en local.
* [Docker](https://www.docker.com/) et Docker Compose si exécution conteneurisée.

## Installation & Démarrage (Local)

### 1. Installation des dépendances
Dans le dossier du frontend, lancez :
```bash
npm install