FROM node:18-alpine

# Cria e define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia o package.json e instala dependências
COPY package.json ./

# Se houver package-lock.json, copie também:
# COPY package-lock.json ./
RUN npm install

# (Opcional) Se você quiser iniciar com um arquivo SQLite vazio,
# basta não copiar nenhum banco e a aplicação criará automaticamente.
# Caso queira providenciar um banco inicial, mantenha o arquivo em src/.

# Exponha a porta que o Fastify vai usar (3000 por padrão)
EXPOSE 5173

# Comando padrão para iniciar a aplicação
CMD ["npm", "start"]
