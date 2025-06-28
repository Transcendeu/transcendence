import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { signJwt, signRefreshJwt } from '../utils/jwt';

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  two_factor_enabled?: boolean;
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function registerRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', async (
    request: FastifyRequest<{ Body: RegisterBody }>,
    reply: FastifyReply
  ) => {
    const { username, email, password } = request.body;

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'All fields are required' });
    }

    try {
      // 1) Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // 2) Criação do usuário no DB-service
      const createUserRes = await fetch(`${DB_SERVICE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password: hashedPassword
        })
      });

      if (!createUserRes.ok) {
        const errorData = await createUserRes.json().catch(() => ({}));
        const message = errorData?.error || 'Failed to create user';
        return reply.code(400).send({ error: message });
      }

      const newUser: User = await createUserRes.json();

      // 3) Geração de tokens via Vault
      const accessToken = await signJwt({ id: newUser.id, email: newUser.email });
      const refreshToken = await signRefreshJwt({ id: newUser.id });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // 4) Armazenamento dos tokens
      await fetch(`${DB_SERVICE_URL}/auth-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: newUser.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString(),
          auth_provider: 'local'
        })
      });

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        }
      });

    } catch (err) {
      console.error('Register error:', err);
      return reply.code(500).send({ error: 'Error processing request' });
    }
  });
}
