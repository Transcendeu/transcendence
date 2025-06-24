import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../utils/authenticate';

interface User {
  id: string;
  username: string;
  email: string;
  two_factor_enabled: boolean;
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function meRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/me', { preHandler: authenticateToken }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const user = (request as FastifyRequest & { user?: { email: string } }).user;

      if (!user || !user.email) {
        return reply.code(400).send({ error: 'User email not found in token' });
      }

      // 1) Busca o usuário no database
      const res = await fetch(`${DB_SERVICE_URL}/users?emailOrUsername=${encodeURIComponent(user.email)}`);

      // 2) Se não vier nenhum usuário, devolve 404
      if (res.status === 404) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // 3) Erros internos
      if (!res.ok) {
        return reply.code(500).send({ error: 'Failed to fetch user' });
      }

      const users: User[] = await res.json();
      const foundUser = Array.isArray(users) ? users[0] : users;

      if (!foundUser || !foundUser.id) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // 3) Retorna somente os campos relevantes
      return {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        twoFactorEnabled: foundUser.two_factor_enabled
      };

    } catch (err) {
      request.log.error('Error fetching /me:', err);
      return reply.code(500).send({ error: 'Error fetching current user' });
    }
  });
}
