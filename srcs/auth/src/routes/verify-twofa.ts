import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import speakeasy from 'speakeasy';
import { authenticateToken } from '../utils/authenticate';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

interface User {
  id: string;
  email: string;
  two_factor_secret?: string;
}

interface Verify2FARoute {
  Body: {
    token?: string;
  };
}

export async function verify2faRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post<Verify2FARoute>('/verify', { preHandler: authenticateToken }, async (
    request: FastifyRequest<Verify2FARoute> & { user?: { id: string; email: string } },
    reply: FastifyReply
  ) => {
    const { token } = request.body;

    if (!token) {
      return reply.code(400).send({ error: 'Token is required' });
    }

    // 1) Busca o usuário
    let user: User | null = null;
    try {
      const res = await fetch(`${DB_SERVICE_URL}/users?emailOrUsername=${encodeURIComponent(request.user?.email || '')}`);
      
      if (res.status === 404) {
        return reply.code(400).send({ error: '2FA not set up' });
      }

      if (!res.ok) {
        throw new Error(`Database error. Status: ${res.status}`);
      }

      const users = await res.json();
      user = Array.isArray(users) ? users[0] : users;
    } catch (err) {
      request.log.error('Database error on GET /users:', err);
      return reply.code(500).send({ error: 'Error on user service' });
    }

    // 2) Verifica se há secret
    if (!user?.two_factor_secret) {
      return reply.code(400).send({ error: '2FA não configurado' });
    }

    // 3) Verifica o token TOTP
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    // 4) Habilita o 2FA no banco
    try {
      const patchRes = await fetch(`${DB_SERVICE_URL}/users/${request.user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ two_factor_enabled: true })
      });

      if (!patchRes.ok) {
        const errorText = await patchRes.text();
        request.log.error('DB PATCH /users failed:', errorText);
        return reply.code(patchRes.status).send({ error: 'Não foi possível habilitar o 2FA' });
      }
    } catch (err) {
      request.log.error('Error enabling 2FA:', err);
      return reply.code(500).send({ error: 'Não foi possível habilitar o 2FA' });
    }

    return reply.send({ message: '2FA enabled successfully' });
  });
}
