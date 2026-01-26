# Utilisation de Python 3.11 pour correspondre à ton environnement local et GitHub
FROM python:3.11-slim

# Configuration des variables d'environnement
# Empêche Python d'écrire des fichiers .pyc
ENV PYTHONDONTWRITEBYTECODE 1
# Force Python à afficher les logs en temps réel (utile pour Docker logs)
ENV PYTHONUNBUFFERED 1

# Définition du dossier de travail
WORKDIR /app

# Installation des dépendances système nécessaires (gcc, etc.)
# Utile si certaines librairies Python doivent être compilées
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copie du fichier de dépendances
COPY requirements.txt .

# Installation des dépendances Python
# On upgrade pip d'abord pour éviter les warnings
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copie du reste du code de l'application
COPY . .

# Exposition du port utilisé par FastAPI
EXPOSE 8000

# Commande de lancement
# Le flag --reload est utile en développement, à retirer en production réelle
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]