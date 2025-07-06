.PHONY: all up down build logs clean fclean re nuke vault-check

DOCKER_COMPOSE_VERSION := $(shell docker compose version | cut -d' ' -f4 | cut -d'.' -f1 | cut -d'v' -f2)

ifeq ($(DOCKER_COMPOSE_VERSION), 2)
	DOCKER = docker compose
else
	DOCKER = docker-compose
endif

IMAGES := frontend auth web-nginx api-gateway relay engine database game-history
DB_VOLUME_NAME := transcendence_database_data

all: vault-check db-setup up

db-setup:
	@if ! docker volume inspect $(DB_VOLUME_NAME) >/dev/null 2>&1; then \
		echo "Creating external volume $(DB_VOLUME_NAME)..."; \
		docker volume create $(DB_VOLUME_NAME); \
	else \
		echo "External volume $(DB_VOLUME_NAME) already exists."; \
	fi

vault-check:
	@echo "Checking if .env has Vault secrets..."
	@if ! tail -n 3 .env | grep -q '^VAULT_TOKEN=' || ! tail -n 3 .env | grep -q '^VAULT_UNSEAL_KEY='; then \
		echo "Vault secrets missing. Running Vault init..."; \
		$(MAKE) -C vault init; \
	else \
		echo "Vault already initialized in .env. Skipping."; \
	fi

up: build
	$(DOCKER) up -d

down:
	$(DOCKER) down

build:
	$(DOCKER) build

rebuild:
	$(DOCKER) build --no-cache

# You can run things like make logs-auth, logs-relay etc
logs-%:
	$(DOCKER) logs -f $*

clean: down
	@echo "Removing built images..."
	-docker rmi $(addsuffix :latest, $(IMAGES))

fclean: clean
	@echo "Removing Docker volumes..."
	-docker volume rm transcendence_database_data
	-docker volume rm transcendence_vault_data
	$(MAKE) -C vault clean

re: clean rebuild up

nuke: down
	docker system prune -a -f
	docker volume prune -f


# env file should look like
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=
# NODE_ENV=development
# AUTH_PORT=4001
# GAME_PORT=4003
# DB_PORT=5000
# DATABASE_URL=http://database:5000
# GAME_HISTORY_SERVICE_URL=https://localhost:8443
# JWT_KEY=signing_key
# JWT_VALUE=secret
# JWT_REFRESH_KEY=signing_refresh_key
# JWT_REFRESH_VALUE=refresh_secret
# JWT_PATH=jwt_path
# VAULT_ADDR=
# VAULT_UNSEAL_KEY=
# VAULT_TOKEN=
