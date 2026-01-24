# Image de base Python légère
FROM python:3.10-slim

# Dossier de travail dans le conteneur
WORKDIR /app

# Copie des requirements pour le cache Docker
COPY requirements.txt .

# Installation des dépendances sans cache pour alléger l'image
RUN pip install --no-cache-dir -r requirements.txt

# Copie du reste du code
COPY . .

# Commande de démarrage
# --host 0.0.0.0 est CRUCIAL pour que Docker expose le port
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]