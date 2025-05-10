FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ensure .env file is copied
COPY .env .env

EXPOSE 3000

CMD ["npm", "start"]
