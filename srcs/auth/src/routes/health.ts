import { FastifyInstance } from 'fastify';

export async function healthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async () => {
    return { status: 'ok' };
  });
}
