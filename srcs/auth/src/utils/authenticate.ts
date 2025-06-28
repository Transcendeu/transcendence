import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt';

interface AuthenticatedRequest extends FastifyRequest {
  user?: any;
}

export const authenticateToken = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new Error('Access token required');
    }

    const decoded = await verifyJwt(token);
    request.user = decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      reply.code(401).send({ error: 'Invalid token' });
    } else {
      reply.code(401).send({ error: err.message || 'Unauthorized' });
    }
  }
};
