# VAULT CONTAINER

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
  curl -X POST http://localhost:3000/secrets/<minha-chave> \
    -H "Content-Type: application/json" \
    -d '{"username": "meuuser", "password": "supersecreta"}'
  ```

- Buscar segredo:
  ```
  curl http://localhost:3000/secrets/<minha-chave>
  ```

## Notas
