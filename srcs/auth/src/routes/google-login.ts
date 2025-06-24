import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { oAuth2Client } from '../utils/g-client';

export async function googleLoginRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/login', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const url = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        prompt: 'consent'
      });

      reply.redirect(url);
    } catch (err) {
      fastify.log.error('Error generating Google auth URL:', err);
      reply.code(500).send({ error: 'Failed to initiate Google login' });
    }
  });
}
