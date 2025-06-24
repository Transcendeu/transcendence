import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
      // Hash da senha (recomendado fazer no backend)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1) Cria usuário no DB-service
      const createUserRes = await fetch(`${DB_SERVICE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        return reply.code(500).send({ error: 'JWT secrets not configured' });
      }

      // 2) Gera tokens
      const accessToken = jwt.sign(
        { id: newUser.id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { id: newUser.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // 3) Persiste tokens no DB-service
      await fetch(`${DB_SERVICE_URL}/auth-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
