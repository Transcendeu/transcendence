FROM node:22-alpine

ARG GAME_HISTORY_SERVICE_URL

WORKDIR /app

COPY package.json ./

RUN npm install

COPY src ./src

COPY tsconfig.json ./

RUN npm run build

CMD ["npm", "start"]
