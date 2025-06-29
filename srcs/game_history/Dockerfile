FROM node:20-alpine AS build

WORKDIR /app

COPY package.json tsconfig.json ./

RUN npm install

COPY  src ./src

RUN npm run build

EXPOSE 4003

CMD ["npm", "start"]
