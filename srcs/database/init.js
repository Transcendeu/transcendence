// srcs/database/init.js

const fastify = require('fastify')({ logger: true });
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. Caminho para o arquivo .sqlite dentro de /database
const DB_DIR   = '/data'; // Aponta diretamente para o diretório montado pelo Docker Compose
const DB_PATH  = path.join(DB_DIR, 'database.sqlite');
// 2. Abre (ou cria) o arquivo SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    fastify.log.error('Erro ao abrir SQLite:', err);
    process.exit(1);
  }
  fastify.log.info('Conectado ao SQLite em:', DB_PATH);
});

// 3. Função para inicializar as tabelas
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela USER
      db.run(`
        CREATE TABLE IF NOT EXISTS USERS (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          two_factor_secret TEXT,
          two_factor_enabled BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'offline',
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela AUTH
      db.run(`
        CREATE TABLE IF NOT EXISTS AUTH (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          access_token TEXT NOT NULL UNIQUE,
          refresh_token TEXT,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          revoked BOOLEAN DEFAULT 0,
          auth_provider TEXT DEFAULT 'local',
          FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE
        )`,
        (err) => 
        {
             if (err) {
                return reject(err);
             }
            resolve();
        }
      );
      db.run(`
        CREATE TABLE IF NOT EXISTS GAME (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          p1_id INTEGER NOT NULL,
          p2_id INTEGER NOT NULL,
          p1_score INTEGER NOT NULL,
          p2_score INTEGER NOT NULL,
          winner_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (p1_id) REFERENCES USERS(id) ON DELETE CASCADE,
          FOREIGN KEY (p2_id) REFERENCES USERS(id) ON DELETE CASCADE,
          FOREIGN KEY (winner_id) REFERENCES USERS(id) ON DELETE CASCADE
        )`,
        (err) =>
        {
             if (err) {
                return reject(err);
             }
            resolve();
        }
      );
    });
  });
};

// 4. Registra plugins / middlewares do Fastify (CORS, Body Parser etc.)
fastify.register(require('@fastify/cors'), {
  origin: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
});
// fastify.register(require('@fastify/formbody'));
// fastify.register(require('@fastify/helmet'));

// 5. Aguarda criação de tabelas, depois define rotas
initDatabase()
  .then(() => {
    fastify.log.info('Banco inicializado com sucesso.');

    // 5.1 Health check
    fastify.get('/health', async (request, reply) => {
      return { status: 'database OK' };
    });

    // 5.2 Criar usuário
    fastify.post('/users', async (request, reply) => {
      const { username, email, password } = request.body;
      if (!username || !email || !password) {
        return reply.code(400).send({ error: 'Campos obrigatórios faltando' });
      }
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO USERS (username, email, password) VALUES (?, ?, ?)',
          [username, email, password],
          function (err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed')) {
                reply.code(400).send({ error: 'Nome de usuário ou e-mail já existente' });
                return reject(err);
              }
              reply.code(500).send({ error: 'Erro no banco de dados: falha ao registrar usuário' });
              return reject(err);
            }
            resolve({ id: this.lastID, username, email });
          }
        );
      });
    });

    // 5.3 Buscar usuário por email ou username
    fastify.get('/users', async (request, reply) => {
    
      const { emailOrUsername } = request.query;
      if (!emailOrUsername) {
        return reply
        .code(400)
        .send({ error: 'Parâmetro email e nome de usuário são obrigatórios' });
      }

      return new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM USERS WHERE email = ? OR username = ?',
          [emailOrUsername, emailOrUsername],
          (err, row) => {
            if (err) {
              reply
                .code(500)
                .send({ error: 'Erro no banco de dados: falha ao buscar usuário' });
              return reject(err);
            }
            if (!row) {
              reply.code(404).send({ error: 'Usuário não encontrado' });
              return resolve({});
            }
            resolve(row);
          }
        );
      });
    });

    // 5.4 Atualizar campos de usuário (ex: two_factor_secret, two_factor_enabled, status, updated_at)
    fastify.patch('/users/:id', async (request, reply) => {
      const userId = request.params.id;
      const updates = request.body;
      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'Nenhum campo para atualizar' });
      }

      // Monta dinamicamente SET ... = ?, ... 
      const fields = Object.keys(updates);
      const values = fields.map(f => updates[f]);
      const placeholders = fields.map(f => `${f} = ?`).join(', ');

      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE USERS SET ${placeholders}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...values, userId],
          function (err) {
            if (err) {
              reply.code(500).send({ error: 'Erro no banco de dados: falha ao recuperar ID' });
              return reject(err);
            }
            resolve({ changes: this.changes });
          }
        );
      });
    });

    // 5.5 Criar token de autenticação (AUTH)
    fastify.post('/auth-tokens', async (request, reply) => {
      const { user_id, access_token, refresh_token, expires_at, auth_provider } = request.body;
      if (!user_id || !access_token || !expires_at) {
        return reply.code(400).send({ error: 'Campos obrigatórios faltando' });
      }
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at, auth_provider)
           VALUES (?, ?, ?, ?, ?)`,
          [user_id, access_token, refresh_token || null, expires_at, auth_provider || 'local'],
          function (err) {
            if (err) {
              reply.code(500).send({ error: 'Erro no banco de dados: falha ao criar token' });
              return reject(err);
            }
            resolve({ id: this.lastID });
          }
        );
      });
    });

    // 5.6 Buscar registros em AUTH (por user_id, access_token ou refresh_token)
    fastify.get('/auth-tokens', async (request, reply) => {
      const { user_id, access_token, refresh_token, revoked } = request.query;
      const filters = [];
      const values = [];

      if (user_id) {
        filters.push('user_id = ?');
        values.push(user_id);
      }
      if (access_token) {
        filters.push('access_token = ?');
        values.push(access_token);
      }
      if (refresh_token) {
        filters.push('refresh_token = ?');
        values.push(refresh_token);
      }
      if (revoked !== undefined) {
        filters.push('revoked = ?');
        values.push(revoked === 'true' ? 1 : 0);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM AUTH ${whereClause}`,
          values,
          (err, rows) => {
            if (err) {
              reply
                .code(500)
                .send({ error: 'Erro no banco de dados: falha ao recuperar token' });
              return reject(err);
            }
            resolve(rows);
          }
        );
      });
    });

    // 5.7 Atualizar registro AUTH (ex: revogar ou atualizar tokens)
    fastify.patch('/auth-tokens/:id', async (request, reply) => {
      const authId = request.params.id;
      const updates = request.body;
      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'Nenhum campo para atualizar' });
      }

      const fields = Object.keys(updates);
      const values = fields.map(f => updates[f]);
      const placeholders = fields.map(f => `${f} = ?`).join(', ');

      return new Promise((resolve, reject) => {
        db.run(
          `UPDATE AUTH SET ${placeholders} WHERE id = ?`,
          [...values, authId],
          function (err) {
            if (err) {
              reply.code(500).send({ error: 'Erro no banco de dados: falha ao atualizar token' });
              return reject(err);
            }
            resolve({ changes: this.changes });
          }
        );
      });
    });

    fastify.post('/games', async (request, reply) => {
      const {p1_id, p2_id, p1_score, p2_score, winner_id} = request.body;

      if (!p1_id || !p2_id || !p1_score || !p2_score || !winner_id ) {
        return reply
                .code(400)
                .send({ error: 'Campos obrigatórios faltando' });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO GAME (p1_id, p2_id, p1_score, p2_score, winner_id) VALUES (?, ?, ?, ?, ?)`,
            [p1_id, p2_id, p1_score, p2_score, winner_id],
            function (err) {
              if (err) {
                return reject(err);
              }
              resolve({ id: this.lastID }); // Retorna o ID do último registro inserido
            }
          );
        });

        return reply.code(201).send({ message: 'Partida registrada com sucesso', game_id: result.id });

      } catch (err) {
        fastify.log.error('Erro ao inserir partida:', err);
        return reply
          .code(500)
          .send({error: 'Não foi possível registrar a partida'});
      }
    });


    // 6. Inicia o servidor Fastify na porta 5000
    const start = async () => {
      try {
        await fastify.listen({
          port: process.env.DB_PORT || 5000,
          host: '0.0.0.0'
        });
        fastify.log.info(`Database service rodando em http://0.0.0.0:${process.env.DB_PORT || 5000}`);
      } catch (err) {
        fastify.log.error(err);
        process.exit(1);
      }
    };

    start();
  })
  .catch(err => {
    fastify.log.error('Erro ao inicializar o banco de dados:', err);
    process.exit(1);
  });
