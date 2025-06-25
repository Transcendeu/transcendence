import { FastifyInstance } from 'fastify';
import { writeSecret, readSecret } from '../utils/vault-client';

export async function secretsRoutes(app: FastifyInstance) {
  app.post<{
    Params: { key: string };
    Body: Record<string, any>;
  }>('/:key', async (request, reply) => {
    const { key } = request.params;
    const body = request.body;

    await writeSecret(key, body);
    reply.send({ status: 'ok' });
  });

  app.get<{
    Params: { key: string };
  }>('/:key', async (request, reply) => {
    const { key } = request.params;

    const data = await readSecret(key);
    if (!data) {
      reply.code(404).send({ error: 'Secret not found' });
    } else {
      reply.send(data);
    }
  });
}
