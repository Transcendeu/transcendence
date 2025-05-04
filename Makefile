.PHONY: up down build logs clean

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f auth

clean:
	docker compose down -v
	rm -rf srcs/auth/node_modules
	rm -rf srcs/auth/database.sqlite
	rm -rf srcs/frontend/node_modules
	rm -rf srcs/frontend/dist
