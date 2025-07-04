#!/bin/bash
set -euo pipefail

DOCKER_COMPOSE_CMD=${1:-docker compose}

jq_query() {
  if command -v jq &>/dev/null; then
    jq "$@"
  else
    docker run --rm -i imega/jq "$@"
  fi
}

# Always resolve paths relative to project root
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
VAULT_SERVICE=vault
VAULT_ADDR=http://localhost:8200
ENV_FILE="$PROJECT_ROOT/.env"
DATA_DIR="$PROJECT_ROOT/vault/data"

echo "Creating Vault volume if it doesn't exist..."
docker volume create transcendence_vault_data >/dev/null

echo "Ensuring correct permissions on transcendence_vault_data volume..."
docker run --rm -v transcendence_vault_data:/vault/data alpine sh -c "chown -R 100:100 /vault/data"

echo "Starting Vault container..."
$DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" -f "./docker-compose.vault-init.yml" up -d $VAULT_SERVICE

echo "Waiting for Vault to be available at $VAULT_ADDR..."

# Wait for Vault to be responsive
while ! curl -s $VAULT_ADDR/v1/sys/health >/dev/null 2>&1; do
  echo "Waiting for Vault to start..."
  sleep 2
done

# Get initialization status
status_json=$(curl -s $VAULT_ADDR/v1/sys/health)
echo "Vault status response: $status_json"

initialized=$(echo "$status_json" | jq_query -r '.initialized')

if [ "$initialized" = "true" ]; then
  echo "Vault is already initialized. Aborting to avoid overwriting."
  exit 1
elif [ "$initialized" = "false" ]; then
  echo "Vault is not initialized. Proceeding with initialization..."
else
  echo "Unexpected Vault initialization status: $initialized"
  exit 1
fi

echo "Initializing Vault..."
init_response=$(curl -s --request POST \
  --data '{"secret_shares":1,"secret_threshold":1}' \
  $VAULT_ADDR/v1/sys/init)

echo "Initialization response:"
echo "$init_response"

UNSEAL_KEY=$(echo "$init_response" | jq_query -r .keys_base64[0])
ROOT_TOKEN=$(echo "$init_response" | jq_query -r .root_token)

if [ -z "$UNSEAL_KEY" ] || [ "$UNSEAL_KEY" = "null" ] || [ -z "$ROOT_TOKEN" ] || [ "$ROOT_TOKEN" = "null" ]; then
  echo "Erro ao inicializar Vault. Verifique logs do container."
  $DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" -f "./docker-compose.vault-init.yml" down
  exit 1
fi

echo "Chaves obtidas:"
echo "Unseal Key: $UNSEAL_KEY"
echo "Root Token: $ROOT_TOKEN"

# Unseal Vault
sealed=$(curl -s $VAULT_ADDR/v1/sys/seal-status | jq_query -r .sealed)

if [ "$sealed" = "true" ]; then
  echo "Desbloqueando Vault com a Unseal Key..."
  curl -s --request PUT \
    --data '{"key": "'"$UNSEAL_KEY"'"}' \
    $VAULT_ADDR/v1/sys/unseal
  echo "Vault unsealed."
fi

# Habilita o secrets engine KV (se ainda não existir)
echo "Verificando se o secrets engine já está habilitado..."
if curl -s -H "X-Vault-Token: $ROOT_TOKEN" "$VAULT_ADDR/v1/sys/mounts" | jq_query -e '."secret/"' >/dev/null; then
  echo "Secrets engine já habilitado no path 'secret/'."
else
  echo "Habilitando secrets engine (KV) no path 'secret/'..."
  curl -s -X POST $VAULT_ADDR/v1/sys/mounts/secret \
    -H "X-Vault-Token: $ROOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "kv",
      "options": {
        "version": "2"
      }
    }'
  echo "Secrets engine habilitado com sucesso!"
fi

echo "Salvando em $ENV_FILE..."

perl -i -0777 -pe 's/\n+\z/\n/' "$ENV_FILE"

sed -i '/^VAULT_UNSEAL_KEY=/d' "$ENV_FILE"
sed -i '/^VAULT_TOKEN=/d' "$ENV_FILE"
sed -i '/^VAULT_ADDR=/d' "$ENV_FILE"

cat >> "$ENV_FILE" <<EOF

VAULT_ADDR=http://vault:8200
VAULT_UNSEAL_KEY=$UNSEAL_KEY
VAULT_TOKEN=$ROOT_TOKEN
EOF

echo "Arquivo $ENV_FILE criado com sucesso!"

echo "Finalizando container Vault..."
$DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" -f "./docker-compose.vault-init.yml" down
echo "Vault container down."
