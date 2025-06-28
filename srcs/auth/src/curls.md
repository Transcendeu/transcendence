# CURLS

## Auth

- Health:
```
curl -X GET http://localhost:4001/
```

- Registrar usuário:
```
curl -X POST http://localhost:4001/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "usuarioTeste2",
    "email": "usuario2@teste.com",
    "password": "senhaSuperSecreta"
  }'
```

- Fazer login:
```
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuarioTeste2",
    "password": "senhaSuperSecreta"
  }'
```

- Fazer logout:
```
curl -X POST http://localhost:4001/api/auth/logout \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

- Setup:
```
curl -X POST http://localhost:4001/api/auth/2fa/setup \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

- 2FA
```
curl -X POST http://localhost:4001/api/auth/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "token": "123456"
  }'
```

- refresh
```
curl -X POST http://localhost:4001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "REFRESH_TOKEN"
  }'
```

- me
```
curl -X GET http://localhost:4001/api/auth/me \
  -H "Authorization: Bearer <SEU_ACCESS_TOKEN>"
```

- Google 2FA
```
curl -X POST http://localhost:4001/api/auth/google/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "TEMP_TOKEN_JWT",
    "twoFactorToken": "TOKEN_2FA"
  }'
```


## Vault
- Verifica os tatus do Vault
```
curl -s http://localhost:8200/v1/sys/health
```

- Cadastrar uma secret no Vault:
```
curl --request POST "http://localhost:8200/v1/secret/data/jwt" \
  --header "X-Vault-Token: meu_token" \
  --header "Content-Type: application/json" \
  --data '{
    "data": {
      "username": "meu_usuario",
      "password": "minha_senha_super_secreta"
    }
  }'
```