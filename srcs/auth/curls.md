# CURLS

## Auth

> Importante: As senhas são hasheadas pelo frontend. O curl não faz esse processo, então ao registrar uma senha via curl, 

### Health:

- Request:
```
curl -X GET http://localhost:4001/api/health | jq
```

- Response:
```json
{
  "status": "ok"
}
```

### /register

- Request:
```
curl -X POST http://localhost:4001/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "usuarioTeste2",
    "email": "usuario2@teste.com",
    "password": "senhaSuperSecreta"
  }' | jq
```

- Response:
```json
{
  "accessToken":"eyJ...",
  "refreshToken":"eyJ...",
  "user":{
    "id":2,
    "username":"usuarioTeste2",
    "email":"usuario2@teste.com"
  }
}
```

### /login (sem 2FA)

- Request:
```
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuarioTeste2",
    "password": "senhaSuperSecreta"
  }' | jq
```

- Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 2,
    "username": "usuarioTeste2",
    "email": "usuario2@teste.com"
  }
}
```

### /refresh

- Request:
```
curl -X POST http://localhost:4001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJ..."
  }' | jq
```

- Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### /logout

- Request:
```
curl -X POST http://localhost:4001/api/auth/logout \
  -H "Authorization: Bearer <accessToken>" | jq
```

- Response:
```json
{
  "message": "Logged out successfully"
}
```

### /2fa/setup:

- Request:
```
curl -X POST http://localhost:4001/api/auth/2fa/setup \
  -H "Authorization: Bearer <accessToken>" | jq
```

- Response:
```json
{
  "secret": "...",
  "qrCode": "data:image/png;base64,..."
}
```

> Ao copiar o valor da key qrCode (data:image/png ...) e colar em um navegador, é possível visuailzar a imagem do QRCode.

### /2fa/verify

- Request:
```
curl -X POST http://localhost:4001/api/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "token": "123456"
  }' | jq
```

- Response:
```json
{
  "message": "2FA enabled successfully"
}
```

### /me

- Request:
```
curl -X GET http://localhost:4001/api/auth/me \
  -H "Authorization: Bearer <accessToken>" | jq
```

- Response:
```json
{
  "id": 2,
  "username": "usuarioTeste2",
  "email": "usuario2@teste.com",
  "twoFactorEnabled": 1
}
```


### /login (com 2FA)

- Request:
```
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuarioTeste2",
    "password": "senhaSuperSecreta",
    "twoFactorToken": "123456"
  }' | jq
```

- Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 2,
    "username": "usuarioTeste2",
    "email": "usuario2@teste.com"
  }
}
```

### /google/login

> Apenas redireciona para login no Google

- Request:
```
curl -i http://localhost:4001/api/auth/google/login
```

- Response:
```
HTTP/1.1 302 Found
access-control-allow-origin: *
access-control-allow-credentials: true
access-control-expose-headers: Content-Length, Content-Range
location: https://accounts.google.com/o/oauth2/v2/auth?...
content-length: 0
Date: Sun, 29 Jun 2025 14:07:49 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

> Retorna um redirecionamento temporário (302), link disponível na location.
> Uma vez que o login é feito, o endpoint `/google/callback` valida o code enviado pela Google.



### /google/2fa/verify

- Request:
```
curl -X POST http://localhost:4001/api/auth/google/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "eyJ...",
    "twoFactorToken": "123456"
  }' | jq
```

- Response:
```

```


## Vault

### /health

- Request:
```
curl -s http://localhost:8200/v1/sys/health | jq
```

- Response:
```json
{
  "initialized": true,
  "sealed": false,
  "standby": false,
  "performance_standby": false,
  "replication_performance_mode": "disabled",
  "replication_dr_mode": "disabled",
  "server_time_utc": 1751204048,
  "version": "1.16.3",
  "enterprise": false,
  "cluster_name": "vault-cluster-025c554e",
  "cluster_id": "1e0ac066-1f7a-5f35-ac56-436c41bbb07f",
  "echo_duration_ms": 0,
  "clock_skew_ms": 0
}
```

> `sealed` precisa estar **false** para que seja possível salvar ou acessar os dados que estão no Vault.


### POST: /secret/data/<secret_path>

> Registra uma secret no Vault em determinado path (pela url)

- Request:
```
curl --request POST "http://localhost:8200/v1/secret/data/secret_path" \
  --header "X-Vault-Token: <vault_token>" \
  --header "Content-Type: application/json" \
  --data '{
    "data": {
      "username": "meu_usuario",
      "password": "minha_senha_super_secreta"
    }
  }'
```

### GET: /secret/data/<secret_path>

> Consulta o segredo registrado em determinado path

- Request:
```
curl --request GET "http://localhost:8200/v1/secret/data/secret_path" \
  --header "X-Vault-Token: <vault_token>"
```
