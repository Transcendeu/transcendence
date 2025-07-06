# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install
RUN apk update && apk add --no-cache sqlite

COPY . .

RUN npm run build

RUN ls -la /app/dist

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=build /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 5000

CMD ["npm", "start"]
