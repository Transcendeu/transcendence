# VAULT CONTAINER

HashiCorp Vault é uma ferramenta para gerenciar segredos (como senhas, tokens, chaves de API) de forma segura e centralizada.

Como o Vault funciona?

- Segredos são guardados em "paths" dentro do Vault, usando backends como KV (Key-Value).

## Directories Structure

```
vault
├── docker-compose.yml
├── Dockerfile
├── package.json
├── src
│   ├── app.ts
│   ├── routes
│   │   └── secrets.ts
│   ├── server.ts
│   └── vaultClient.ts
└── tsconfig.json
```



## Commands

> Não roda local somente com npm porque requer instância do Vault.

Docker:
- `docker-compose up --build -d`: Sobe o container
- `docker-compose logs api`: Exibe os logs
- `docker-compose down`: Derruba o container

NPM:
- ~~`npm install`: Instala os pacotes do package.json~~
- ~~`npm run build`: Builda o projeto (pra JS)~~
- ~~`npm start`: Executa o projeto localmente~~


## Curls

- Cadastrar segredo:
  ```
  curl -X POST http://localhost:3082/secrets/<minha-chave> \
    -H "Content-Type: application/json" \
    -d '{"username": "meuuser", "password": "supersecreta"}'
  ```

- Buscar segredo:
  ```
  curl http://localhost:3082/secrets/<minha-chave>
  ```

- Buscar segredo pela versão:
  ```
  curl \
    --header "X-Vault-Token: VAULT_TOKEN" \
    http://127.0.0.1:8200/v1/secret/data/<minha-chave>?version=1
  ```

## Notas
