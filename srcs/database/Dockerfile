FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install
RUN apk update && apk add --no-cache sqlite

COPY . .

RUN mkdir -p /data && chown -R node:node /data

EXPOSE 5000

USER node

CMD ["npm", "start"]
