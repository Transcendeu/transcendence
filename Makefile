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
	$(DOCKER) build

logs:
	$(DOCKER) logs -f auth

clean: down
#docker rmi transcendence-frontend:latest transcendence-auth:latest transcendence-web-nginx:latest transcendence-api-gateway:latest transcendence-relay:latest transcendence-engine:latest
	docker system prune -a
	rm -rf srcs/vault/node_modules
	rm -rf srcs/vault/dist
	rm -rf srcs/auth/node_modules
	rm -rf srcs/auth/database.sqlite
	rm -rf srcs/frontend/node_modules
	rm -rf srcs/frontend/dist

re: clean up
