.PHONY: up down build logs clean

DOCKER_COMPOSE_VERSION:=$(shell docker compose version | cut -d' ' -f4 | cut -d'.' -f1 | cut -d'v' -f2)

ifeq ($(DOCKER_COMPOSE_VERSION), 2)
	DOCKER=docker compose
else
	DOCKER=docker-compose
endif

all: vault-check up

vault-check:
	@echo "Checking if .env has Vault secrets..."
	@if ! tail -n 3 .env | grep -q '^VAULT_TOKEN=' || ! tail -n 3 .env | grep -q '^VAULT_UNSEAL_KEY='; then \
		echo "Vault secrets missing. Running Vault init..."; \
		sudo make -C vault init; \
	else \
		echo "Vault already initialized in .env. Skipping."; \
	fi

up:
	$(DOCKER) up -d

down:
	$(DOCKER) down

build:
	$(DOCKER) build --no-cache

logs:
	$(DOCKER) logs -f auth

clean: down
# docker rmi transcendence-frontend:latest transcendence-auth:latest transcendence-web-nginx:latest transcendence-api-gateway:latest transcendence-relay:latest transcendence-engine:latest transcendence-database:latest
	docker system prune -a

fclean: clean
	sudo make -C vault clean
	rm -rf ./database

re: clean up

# env file should look like
# GOOGLE_CLIENT_ID=xxx
# GOOGLE_CLIENT_SECRET=xxx
# GOOGLE_CALLBACK_URL='http://localhost/api/auth/google/callback'
# NODE_ENV=development
# AUTH_PORT=4001
# GAME_PORT=4003
# DB_PORT=5000
# GAME_HISTORY_SERVICE_URL=http://game-history:4003
# DATABASE_URL=http://database:5000
# JWT_KEY=signing_key
# JWT_VALUE=secret
# JWT_REFRESH_KEY=signing_refresh_key
# JWT_REFRESH_VALUE=refresh_secret
# JWT_PATH=jwt_path
# VAULT_ADDR=http://vault:8200
# VAULT_TOKEN=xxx
# VAULT_UNSEAL_KEY=xxx
