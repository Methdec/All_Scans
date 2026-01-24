# Image Node.js basée sur Alpine (légère)
FROM node:18-alpine

WORKDIR /app

# Copie des fichiers package.json
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du reste du code source
COPY . .

# On expose le port 3000
EXPOSE 3000

# Démarrage du serveur de développement
CMD ["npm", "start"]