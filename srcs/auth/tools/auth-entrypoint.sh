#!/bin/sh

echo "Starting Auth service..."

node dist/server.js &

pid=$!

# Aguarda o servidor ficar disponível
until curl -sf $VAULT_ADDR/v1/sys/health > /dev/null; do
  echo "Waiting for Vault server to be ready..."
  sleep 1
done

echo "===== DEBUG: Vault mounts (raw) token: $VAULT_TOKEN ====="
curl -s -v -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/sys/mounts" -o vault_mounts_raw.json 2>&1 | tee /dev/stderr
echo "===== DEBUG: Vault mounts (parsed) ====="
cat vault_mounts_raw.json | jq
echo "===== END DEBUG ====="


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
