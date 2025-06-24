# Stage 1: Build
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

COPY package*.json tsconfig.json ./

# Install dependencies before copying other files
RUN npm install

COPY src ./src

RUN npm run build

RUN ls -la /app/dist

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

#COPY --from=build /app/.env ./
COPY --from=build /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3005

CMD ["npm", "start"]
