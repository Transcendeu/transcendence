FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions first
COPY package*.json ./

# Install dependencies before copying other files
RUN npm install

# Now copy the rest of the app
COPY . .

# Ensure env file is optional in build (mainly used in runtime)
# No need to COPY .env explicitly if you use `env_file` in docker-compose

EXPOSE 3000

CMD ["npm", "start"]
