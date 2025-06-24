# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install

COPY src ./src

RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

RUN apk update && apk add --no-cache curl

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

COPY tools/vault-entrypoint.sh ./tools/vault-entrypoint.sh
RUN chmod 755 /app/tools/vault-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3082

CMD ["sh", "tools/vault-entrypoint.sh"]