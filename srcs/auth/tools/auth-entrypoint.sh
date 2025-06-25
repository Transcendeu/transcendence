#!/bin/sh

echo "Starting Auth service..."

echo Teste
echo $AUTH_PORT
echo $JWT_KEY
echo $JWT_VALUE
echo Fim

node dist/server.js &

pid=$!

# Aguarda o servidor ficar disponível
until curl -sf http://vault:8200/v1/sys/health > /dev/null; do
  echo "Waiting for Vault server to be ready..."
  sleep 1
done

if [ -z "$JWT_KEY" ] || [ -z "$JWT_VALUE" ]; then
  echo "ERROR: JWT_KEY or JWT_VALUE not set"
  kill $pid
  exit 1
fi



response=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://localhost:$AUTH_PORT/secrets/jwt \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${JWT_KEY}\", \"password\": \"${JWT_VALUE}\"}"
  )

if [ "$response" -ne 200 ]; then
  echo "Failed to set secret, status code: $response"
  kill $pid
  exit 1
fi

echo "Secret set successfully. Vault service running."

wait $pid
