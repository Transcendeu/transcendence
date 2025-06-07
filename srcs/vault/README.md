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

- `npm install`: Instala os pacotes do package.json
- `npm run build`: Builda o projeto (pra JS)
- `npm start`: Executa o projeto localmente

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
