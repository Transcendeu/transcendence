#!/bin/bash
set -euo pipefail

DOCKER_COMPOSE_CMD=${1:-docker compose}

if ! command -v jq &> /dev/null; then
  echo "jq not found locally, using Docker fallback..."
  jq() {
    docker run --rm -i imega/jq jq "$@"
  }
fi

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

echo "Vault container up."
$DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" up -d $VAULT_SERVICE

echo "Esperando Vault ficar disponível em $VAULT_ADDR..."

until \
  status_json=$(curl -s $VAULT_ADDR/v1/sys/health 2>/dev/null) && \
  initialized=$(echo "$status_json" | jq -r '.initialized' 2>/dev/null) && \
  { [ "$initialized" = "false" ] || [ "$initialized" = "true" ]; }; do
  echo "Aguardando Vault..."
  sleep 2
done

initialized=$(echo "$status_json" | jq -r '.initialized')

if [ "$initialized" == "true" ]; then
  echo "Vault já está inicializado. Abortando para evitar sobrescrita."
  exit 1
fi

# # Garante diretório persistente com permissões
# echo "Criando diretório persistente $DATA_DIR..."
# mkdir -p "$DATA_DIR"
# chown 100:100 "$DATA_DIR"
# chmod 700 "$DATA_DIR"

echo "Inicializando Vault..."

init_response=$(curl -s --request POST \
  --data '{"secret_shares":1,"secret_threshold":1}' \
  $VAULT_ADDR/v1/sys/init)

echo "Resposta da inicialização:"
echo "$init_response"

UNSEAL_KEY=$(echo "$init_response" | jq -r .keys_base64[0])
ROOT_TOKEN=$(echo "$init_response" | jq -r .root_token)

if [ -z "$UNSEAL_KEY" ] || [ "$UNSEAL_KEY" = "null" ] || [ -z "$ROOT_TOKEN" ] || [ "$ROOT_TOKEN" = "null" ]; then
  echo "Erro ao inicializar Vault. Verifique logs do container."
  $DOCKER_COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" down
  exit 1
fi

echo "Chaves obtidas:"
echo "Unseal Key: $UNSEAL_KEY"
echo "Root Token: $ROOT_TOKEN"

# Unseal Vault
sealed=$(curl -s $VAULT_ADDR/v1/sys/seal-status | jq -r .sealed)

if [ "$sealed" = "true" ]; then
  echo "Desbloqueando Vault com a Unseal Key..."
  curl -s --request PUT \
    --data '{"key": "'"$UNSEAL_KEY"'"}' \
    $VAULT_ADDR/v1/sys/unseal
  echo "Vault unsealed."
fi

# Habilita o secrets engine KV (se ainda não existir)
echo "Verificando se o secrets engine já está habilitado..."
if curl -s -H "X-Vault-Token: $ROOT_TOKEN" "$VAULT_ADDR/v1/sys/mounts" | jq -e '."secret/"' >/dev/null; then
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
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down
echo "Vault container down."
