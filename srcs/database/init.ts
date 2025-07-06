import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sqlite3 from 'sqlite3';
import path from 'path';

// 1. Inicializa Fastify
const fastify: FastifyInstance = Fastify({ logger: true });

// 2. Configuração do SQLite
const sqlite = sqlite3.verbose();
const DB_DIR = '/data';
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

// Initialize db as null initially, will be assigned after connection.
// This is typical for global db instances in Node.js apps.
let db: sqlite3.Database;

// Connect to the database. This callback handles initial connection errors.
try {
  db = new sqlite.Database(DB_PATH, (err: Error | null) => {
    if (err) {
      fastify.log.error('Erro ao abrir SQLite:', err);
      // Critical error: exit the process if database connection fails at startup
      process.exit(1);
    }
    fastify.log.info('Conectado ao SQLite em:', DB_PATH);
  });
} catch (error) {
  fastify.log.error('Erro fatal ao inicializar o banco de dados:', error);
  process.exit(1);
}

// DTOs e Interfaces (Mantidas inalteradas)
interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
}

type UserRow = {
  id: number;
  username: string;
  email: string;
  password: string;
  two_factor_secret: string | null;
  two_factor_enabled: 0 | 1;
  status: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
};

interface UpdateUserDTO {
  [key: string]: string | number | boolean;
}

interface CreateAuthDTO {
  user_id: number;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  auth_provider?: string;
}

type AuthRow = {
  id: number;
  user_id: number;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  created_at: string;
  revoked: 0 | 1;
  auth_provider: string;
};

interface CreateGameDTO {
  p1_id: number;
  p2_id: number;
  p1_score: number;
  p2_score: number;
  winner_id: number;
}

type GameRow = {
  id: number;
  p1_id: number;
  p1_username: string;
  p2_id: number;
  p2_username: string;
  p1_score: number;
  p2_score: number;
  winner_id: number;
  winner_username: string;
  created_at: string;
};

// --- Funções Auxiliares Promisificadas para SQLite ---
// Wrapper para db.run
function run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        return reject(err);
      }
      // 'this' context contains lastID and changes for successful runs
      resolve(this);
    });
  });
}

// Wrapper para db.get (retorna uma única linha ou undefined)
function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) {
        return reject(err);
      }
      // If no row found, sqlite3 returns undefined/null, so we return undefined for clarity
      resolve(row || undefined);
    });
  });
}

// Wrapper para db.all (retorna um array de linhas)
function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

// Função para inicializar as tabelas (agora usa as funções promisificadas)
async function initDatabase(): Promise<void> {
  await run(`
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

  await run(`
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
    )
  `);

  await run(`
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
    )
  `);
}

// Plugins e Middlewares (Mantidos inalterados)
fastify.register(import('@fastify/cors'), {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Inicialização e Rotas
initDatabase()
  .then(() => {
    fastify.log.info('Banco inicializado com sucesso.');

    // Health check
    fastify.get('/health', async () => ({ status: 'database OK' }));

    // 1) Criar usuário
    fastify.post<{ Body: CreateUserDTO }>('/users', async (
		request: FastifyRequest<{ Body: CreateUserDTO }>, 
		reply:FastifyReply) => {
      const { username, email, password } = request.body;
      if (!username || !email || !password) {
        return reply.code(400).send({ error: 'Campos obrigatórios faltando' });
      }
      try {
        const result = await run(
          'INSERT INTO USERS (username, email, password) VALUES (?, ?, ?)',
          [username, email, password]
        );
        return reply.code(201).send({ id: result.lastID, username, email });
      } catch (err: any) { // Use 'any' for general errors, or narrow if specific error types are known
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return reply.code(400).send({ error: 'Nome de usuário ou e-mail já existente' });
        }
        fastify.log.error('Erro ao registrar usuário:', err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao registrar usuário' });
      }
    });

    // 2) Buscar usuário por email ou username
    fastify.get<{ Querystring: { emailOrUsername: string } }>('/users', async (
		request: FastifyRequest<{ Querystring: { emailOrUsername: string } }>, 
		reply: FastifyReply
	) => {
      const { emailOrUsername } = request.query;
      if (!emailOrUsername) {
        return reply.code(400).send({ error: 'Parâmetro email e nome de usuário são obrigatórios' });
      }
      try {
        const user = await get<UserRow>(
          'SELECT * FROM USERS WHERE email = ? OR username = ?',
          [emailOrUsername, emailOrUsername]
        );
        if (!user) {
          return reply.code(404).send({ error: 'Usuário não encontrado' });
        }
        return user; // Fastify will automatically send this as JSON
      } catch (err) {
        fastify.log.error(`Erro ao buscar usuário '${emailOrUsername}':`, err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao buscar usuário' });
      }
    });

    // 3) Atualizar usuário
    fastify.patch<{ Params: { id: string }; Body: UpdateUserDTO }>('/users/:id', async (
		request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDTO }>,
		reply: FastifyReply
	) => {
      const userId = request.params.id;
      const updates = request.body;
      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'Nenhum campo para atualizar' });
      }
      const fields = Object.keys(updates);
      const values = fields.map(f => updates[f]);
      const placeholders = fields.map(f => `${f} = ?`).join(', ');

      try {
        const result = await run(
          `UPDATE USERS SET ${placeholders}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...values, userId]
        );
        return { changes: result.changes };
      } catch (err) {
        fastify.log.error(`Erro ao atualizar usuário ${userId}:`, err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao atualizar usuário' });
      }
    });

    // 4) Criar token de autenticação
    fastify.post<{ Body: CreateAuthDTO }>('/auth-tokens', async (
		request: FastifyRequest<{ Body: CreateAuthDTO }> , 
		reply: FastifyReply
	) => {
      const { user_id, access_token, refresh_token, expires_at, auth_provider } = request.body;
      if (!user_id || !access_token || !expires_at) {
        return reply.code(400).send({ error: 'Campos obrigatórios faltando' });
      }
      try {
        const result = await run(
          `INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at, auth_provider)
           VALUES (?, ?, ?, ?, ?)`,
          [user_id, access_token, refresh_token || null, expires_at, auth_provider || 'local']
        );
        return reply.code(201).send({ id: result.lastID });
      } catch (err) {
        fastify.log.error('Erro ao criar token:', err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao criar token' });
      }
    });

    // 5) Buscar tokens de autenticação
    fastify.get<{ Querystring: { user_id?: string; access_token?: string; refresh_token?: string; revoked?: string } }>
      ('/auth-tokens', async (
			request: FastifyRequest<{ Querystring: { user_id?: string; access_token?: string; refresh_token?: string; revoked?: string } }>, 
			reply: FastifyReply
	  ) => {
      const { user_id, access_token, refresh_token, revoked } = request.query;
      const filters: string[] = [];
      const values: (string | number)[] = [];
      if (user_id) { filters.push('user_id = ?'); values.push(Number(user_id)); }
      if (access_token) { filters.push('access_token = ?'); values.push(access_token); }
      if (refresh_token) { filters.push('refresh_token = ?'); values.push(refresh_token); }
      // Convert 'true'/'false' string to 1/0 for boolean in SQLite
      if (revoked !== undefined) { filters.push('revoked = ?'); values.push(revoked === 'true' ? 1 : 0); }
      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      try {
        const rows = await all<AuthRow>(
          `SELECT * FROM AUTH ${whereClause}`,
          values
        );
        return rows;
      } catch (err) {
        fastify.log.error('Erro ao recuperar tokens:', err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao recuperar tokens' });
      }
    });

    // 6) Atualizar token de autenticação
    fastify.patch<{ Params: { id: string }; Body: Partial<CreateAuthDTO> }>
      ('/auth-tokens/:id', async (
		request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateAuthDTO> }>,
		reply: FastifyReply
	) => {
      const authId = request.params.id;
      const updates = request.body;
      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'Nenhum campo para atualizar' });
      }
      const fields = Object.keys(updates);
      // Casting to 'any' for dynamic access is common here,
      // as Partial<CreateAuthDTO> might not allow direct string indexing without it.
      const values = fields.map(f => (updates as any)[f]);
      const placeholders = fields.map(f => `${f} = ?`).join(', ');

      try {
        const result = await run(
          `UPDATE AUTH SET ${placeholders} WHERE id = ?`,
          [...values, authId]
        );
        return { changes: result.changes };
      } catch (err) {
        fastify.log.error(`Erro ao atualizar token ${authId}:`, err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao atualizar token' });
      }
    });

    // 7) Registrar partida
    fastify.post<{ Body: CreateGameDTO }>('/games', async (
		request: FastifyRequest<{ Body: CreateGameDTO }>, 
		reply: FastifyReply
	) => {
      const { p1_id, p2_id, p1_score, p2_score, winner_id } = request.body;
      if (p1_id == null || p2_id == null || p1_score == null || p2_score == null || winner_id == null) {
        return reply.code(400).send({ error: 'Campos obrigatórios faltando' });
      }
      try {
        const result = await run(
          `INSERT INTO GAME (p1_id, p2_id, p1_score, p2_score, winner_id)
           VALUES (?, ?, ?, ?, ?)`,
          [p1_id, p2_id, p1_score, p2_score, winner_id]
        );
        return reply.code(201).send({ message: 'Partida registrada com sucesso', game_id: result.lastID });
      } catch (err) {
        fastify.log.error('Erro ao registrar partida:', err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao registrar partida' });
      }
    });

    // 8) Buscar histórico de partidas de um usuário
    fastify.get<{ Params: { id: string } }>('/games/users/:id/history', async (
		request: FastifyRequest<{ Params: { id: string } }>, 
		reply: FastifyReply
	) => {
      const userId = request.params.id;
      if (!userId) {
        return reply.code(400).send({ error: 'ID do usuário é obrigatório' });
      }
      try {
        const rows = await all<GameRow>(
          `SELECT
            G.id,
            G.p1_id,
            U1.username AS p1_username,
            G.p2_id,
            U2.username AS p2_username,
            G.p1_score,
            G.p2_score,
            G.winner_id,
            Gw.username AS winner_username,
            G.created_at
          FROM GAME G
          JOIN USERS U1 ON G.p1_id = U1.id
          JOIN USERS U2 ON G.p2_id = U2.id
          JOIN USERS Gw ON G.winner_id = Gw.id
          WHERE G.p1_id = ? OR G.p2_id = ?
          ORDER BY G.created_at DESC`,
          [userId, userId]
        );
        return rows;
      } catch (err) {
        fastify.log.error('Erro ao buscar histórico:', err);
        return reply.code(500).send({ error: 'Erro no banco de dados: falha ao buscar histórico' });
      }
    });

    // 9) Inicia o servidor
    fastify.listen({ port: +(process.env.DB_PORT || 5000), host: '0.0.0.0' })
      .then(() => fastify.log.info(`Database service rodando em http://0.0.0.0:${process.env.DB_PORT || 5000}`))
      .catch(err => {
        fastify.log.error('Erro ao iniciar o servidor Fastify:', err);
        process.exit(1); // Exit on server startup failure
      });
  })
  .catch(err => {
    // This catch block handles errors from initDatabase()
    fastify.log.error('Erro ao inicializar o banco de dados:', err);
    process.exit(1); // Exit on database initialization failure
  });