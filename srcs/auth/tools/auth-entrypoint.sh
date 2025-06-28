#!/bin/sh

echo "Starting Auth service..."

node dist/server.js &
pid=$!

# Espera Vault estar disponível e inicializado
until status_json=$(curl -s $VAULT_ADDR/v1/sys/health 2>/dev/null) && \
      initialized=$(echo "$status_json" | jq -r '.initialized') && \
      [ "$initialized" = "true" ]; do
  echo "Aguardando Vault inicializado e pronto..."
  sleep 2
done

# Verifica se Vault está sealed
sealed=$(echo "$status_json" | jq -r '.sealed')

if [ "$sealed" = "true" ]; then
  echo "Vault sealed. Unsealing..."

  curl -s --request PUT \
    --data '{"key": "'"$VAULT_UNSEAL_KEY"'"}' \
    $VAULT_ADDR/v1/sys/unseal

  echo "Vault unsealed."
fi

# Coloca segredo no Vault (usando o mesmo caminho 'jwt' para as duas chaves)
if [ -z "$JWT_KEY" ] || [ -z "$JWT_VALUE" ] || [ -z "$JWT_REFRESH_KEY" ] || [ -z "$JWT_REFRESH_VALUE" ]; then
  echo "ERROR: JWT_KEY, JWT_VALUE, JWT_REFRESH_KEY or JWT_REFRESH_VALUE not set"
  kill $pid
  exit 1
fi

response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VAULT_ADDR/v1/secret/data/$JWT_PATH" \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "'"$JWT_KEY"'": "'"$JWT_VALUE"'",
      "'"$JWT_REFRESH_KEY"'": "'"$JWT_REFRESH_VALUE"'"
    }
  }')

echo "Vault response code: $response"

if [ "$response" -ne 200 ]; then
  echo "Failed to set secret, status code: $response"
  kill $pid
  exit 1
fi

echo "Token secret set successfully. Vault service running."

wait $pid
