FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install
RUN apk add --no-cache sqlite

COPY . .

RUN mkdir -p /usr/src/app/database \
    && chown -R node:node /usr/src/app/database

EXPOSE 5000

USER node

CMD ["npm", "start"]
