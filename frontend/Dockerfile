FROM node:18-alpine

WORKDIR /app

# Ajout au PATH pour plus de sécurité
ENV PATH /app/node_modules/.bin:$PATH

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]