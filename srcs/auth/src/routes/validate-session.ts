import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../utils/authenticate';

export async function validateSessionRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/validate-session', { preHandler: authenticateToken }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // Manually cast request.body to expected shape
    const body = request.body as { username: string };
    const { username } = body;
    // Cast request to access custom token payload
    const user = (request as FastifyRequest & { user?: { username: string } }).user;
    
    console.log('[Auth] validate-session: token username =', user?.username);
    console.log('[Auth] validate-session: body username =', body.username);
    if (!user?.username) {
      return reply.code(401).send({ error: 'Invalid token payload' });
    }

    if (user.username !== username) {
      return reply.code(401).send({ error: 'Token username mismatch' });
    }

    return reply.send({ ok: true });
  });
}
