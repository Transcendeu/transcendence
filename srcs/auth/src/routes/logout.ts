import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../utils/authenticate';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

interface AuthTokenRecord {
  id: string;
  revoked: number | boolean;
  access_token: string;
}

export async function logoutRoute(fastify: FastifyInstance) {
  fastify.post('/logout', { preHandler: authenticateToken }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.code(400).send({ error: 'Authorization header missing' });
      }

      const accessToken = authHeader.split(' ')[1];
      if (!accessToken) {
        return reply.code(400).send({ error: 'Access token is required' });
      }

      // Busca o token no database-service
      const res = await fetch(`${DB_SERVICE_URL}/auth-tokens?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        request.log.error('Error fetching auth tokens:', await res.text());
        return reply.code(500).send({ error: 'Error fetching auth tokens' });
      }

      const authRecords: AuthTokenRecord[] = await res.json();

      if (authRecords.length === 0) {
        return reply.code(404).send({ error: 'Error revoking token' });
      }

      const authId = authRecords[0].id;

      // Marca token como revogado
      const patchRes = await fetch(`${DB_SERVICE_URL}/auth-tokens/${authId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: 1 })
      });

      if (!patchRes.ok) {
        request.log.error('Error revoking token:', await patchRes.text());
        return reply.code(500).send({ error: 'Error revoking token' });
      }

      return { message: 'Logged out successfully' };
    } catch (err) {
      request.log.error('Logout error:', err);
      return reply.code(500).send({ error: 'Unable to log out' });
    }
  });
}
