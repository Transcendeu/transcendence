import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { signJwt, signRefreshJwt } from '../utils/jwt';

interface LoginBody {
  username: string;
  password: string;
  twoFactorToken?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  password: string; // hash salvo no banco
  two_factor_enabled: boolean;
  two_factor_secret?: string;
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function loginRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/login', async (
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply
  ) => {
    const { username, password, twoFactorToken } = request.body;

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username/Email and password are required' });
    }

    try {
      // 1) Busca o usuário no DB-service
      const userRes = await fetch(`${DB_SERVICE_URL}/users?emailOrUsername=${encodeURIComponent(username)}`);
      if (userRes.status === 404) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
      if (!userRes.ok) {
        return reply.code(500).send({ error: 'Error fetching user' });
      }

      const userData: User[] = await userRes.json();
      const foundUser = Array.isArray(userData) ? userData[0] : userData;

      if (!foundUser) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // 2) Verifica senha
      const valid = await bcrypt.compare(password, foundUser.password);
      if (!valid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // 3) 2FA (se habilitado)
      if (foundUser.two_factor_enabled) {
        if (!twoFactorToken) {
          return reply.code(403).send({ error: '2FA token required', requiresTwoFactor: true });
        }

        const verified = speakeasy.totp.verify({
          secret: foundUser.two_factor_secret || '',
          encoding: 'base32',
          token: twoFactorToken
        });

        if (!verified) {
          return reply.code(401).send({ error: 'Invalid 2FA token' });
        }
      }

      // 4) Gera tokens com seu módulo JWT
      const accessToken = await signJwt({ id: foundUser.id, email: foundUser.email, username: foundUser.username });
      const refreshToken = await signRefreshJwt({ id: foundUser.id });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // 5) Persiste tokens no DB-service
      const patchRes = await fetch(`${DB_SERVICE_URL}/auth-tokens/${foundUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString()
        })
      });

      // se PATCH falhar, tenta criar novo registro
      if (!patchRes.ok) {
        await fetch(`${DB_SERVICE_URL}/auth-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: foundUser.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt.toISOString(),
            auth_provider: 'local'
          })
        });
      }

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email
        }
      });

    } catch (error) {
      request.log.error('Login error:', error);
      return reply.code(500).send({ error: 'Error processing request' });
    }
  });
}
