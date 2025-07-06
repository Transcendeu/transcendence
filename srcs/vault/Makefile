DOCKER_COMPOSE_VERSION:=$(shell docker compose version | cut -d' ' -f4 | cut -d'.' -f1 | cut -d'v' -f2)

ifeq ($(DOCKER_COMPOSE_VERSION), 2)
	DOCKER=docker compose
else
	DOCKER=docker-compose
endif

init:
	./vault-init.sh "$(DOCKER)"

up:
	$(DOCKER) up -d vault

down:
	$(DOCKER) down vault

logs:
	$(DOCKER) logs -f vault

clean:
#	@echo "Removing Vault data directory..."
#	sudo rm -rf ./data
	@if [ -f "../../.env" ]; then \
		echo "Cleaning Vault variables from ../../.env..."; \
		sed -i '/^VAULT_ADDR=/d' ../../.env; \
		sed -i '/^VAULT_TOKEN=/d' ../../.env; \
		sed -i '/^VAULT_UNSEAL_KEY=/d' ../../.env; \
		echo "Vault-related .env entries removed."; \
	else \
		echo "Env file not found, skipping .env cleanup."; \
	fi
	@echo "Vault reset complete."
