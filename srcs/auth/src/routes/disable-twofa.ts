import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../utils/authenticate';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function disable2faRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/disable', { preHandler: authenticateToken }, async (
    request: FastifyRequest & { user?: { id: string } },
    reply: FastifyReply
  ) => {
    if (!request.user?.id) {
      return reply.code(400).send({ error: 'User not authenticated' });
    }

    try {
      const patchRes = await fetch(`${DB_SERVICE_URL}/users/${request.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          two_factor_secret: null,
          two_factor_enabled: false
        })
      });

      if (!patchRes.ok) {
        request.log.error('Error disabling 2FA:', await patchRes.text());
        return reply.code(500).send({ error: 'Failed to disable 2FA' });
      }

      return reply.send({ success: true });
    } catch (error) {
      request.log.error('Error disabling 2FA:', error);
      return reply.code(500).send({ error: 'Error processing request' });
    }
  });
}
