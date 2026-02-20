# MTG Collection Manager - Frontend

Bienvenue sur l'interface utilisateur du **Gestionnaire de Collection Magic: The Gathering**.
Cette application React permet aux joueurs de gérer leur inventaire physique, de construire des decks et d'analyser leurs statistiques de mana grâce à une interface moderne et intuitive.

## Fonctionnalités Clés

* **Gestion d'Inventaire** : Importation de listes, recherche par filtres (couleurs, rareté, type) et visualisation des cartes.
* **Deckbuilder Avancé** : Création de decks, ajout de cartes via modales, et distinction entre decks **Virtuels** (Listes) et **Construits** (Physiques).
* **Statistiques Visuelles** : Graphiques interactifs pour la courbe de mana et la répartition des couleurs (*Recharts*).
* **Auto-Balance** : Algorithme intelligent pour calculer et ajuster automatiquement la base de mana (Terrains).
* **Navigation Fluide** : Système de dossiers hiérarchiques et fil d'ariane pour organiser les decks.

## Stack Technique

* **Framework** : React.js (Create React App)
* **Routing** : React Router DOM v6
* **Graphiques** : Recharts
* **Styles** : CSS Modules & Variables CSS (Thème sombre)

## Installation & Démarrage

Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé.

### 1. Installation des dépendances
Dans le dossier du frontend, lancez :
```bash
npm install