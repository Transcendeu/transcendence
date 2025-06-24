.PHONY: up down build logs clean

DOCKER_COMPOSE_VERSION:=$(shell docker compose version | cut -d' ' -f4 | cut -d'.' -f1 | cut -d'v' -f2)

ifeq ($(DOCKER_COMPOSE_VERSION), 2)
	DOCKER=docker compose
else
	DOCKER=docker-compose
endif

up:
	$(DOCKER) up -d

down:
	$(DOCKER) down

build:
	$(DOCKER) build --no-cache

logs:
	$(DOCKER) logs -f auth

clean: down
#	docker rmi transcendence-frontend:latest transcendence-auth:latest transcendence-web-nginx:latest transcendence-api-gateway:latest transcendence-relay:latest transcendence-engine:latest
	docker system prune -a
	rm -rf srcs/vault/node_modules
	rm -rf srcs/vault/dist
	rm -rf srcs/auth/node_modules
	rm -rf srcs/auth/database.sqlite
	rm -rf srcs/frontend/node_modules
	rm -rf srcs/frontend/dist

re: clean up


#env file should look like
# GOOGLE_CLIENT_ID=????
# GOOGLE_CLIENT_SECRET=????
# GOOGLE_CALLBACK_URL=????
# NODE_ENV=development
# VAULT_DEV_ROOT_TOKEN_ID=my-root-token
# VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200
# VAULT_TOKEN=my-root-token
# JWT_SECRET=jwt_secret
# JWT_REFRESH_SECRET=jwt_refresh
# JWT_KEY=signing_key
# JWT_VALUE=????
# VAULT_ADDR=http://vault:8200
# VAULT_TOKEN=root-token
# VAULT_PORT=3082
# AUTH_PORT=3005
# DB_PORT=5000
# DATABASE_URL=http://database:5000