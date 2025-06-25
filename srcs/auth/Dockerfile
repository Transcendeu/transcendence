# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install

COPY src ./src

RUN npm run build

RUN ls -la /app/dist

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk update && apk add --no-cache curl jq

COPY --from=build /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

COPY tools/auth-entrypoint.sh ./tools/auth-entrypoint.sh
RUN chmod 755 /app/tools/auth-entrypoint.sh

EXPOSE 4001

CMD ["sh", "tools/auth-entrypoint.sh"]
