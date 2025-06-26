#!/bin/sh

echo "Starting Auth service..."

node dist/server.js &
pid=$!

# Espera Vault estar disponível
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

# Coloca segredo no Vault
if [ -z "$JWT_KEY" ] || [ -z "$JWT_VALUE" ]; then
  echo "ERROR: JWT_KEY or JWT_VALUE not set"
  kill $pid
  exit 1
fi

response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VAULT_ADDR/v1/secret/data/jwt" \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "username": "'"$JWT_KEY"'",
      "password": "'"$JWT_VALUE"'"
    }
  }')

echo "Vault response code: $response"

if [ "$response" -ne 200 ]; then
  echo "Failed to set secret, status code: $response"
  kill $pid
  exit 1
fi

echo "Secret set successfully. Vault service running."

wait $pid
