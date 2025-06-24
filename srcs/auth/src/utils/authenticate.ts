import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface AuthenticatedRequest extends FastifyRequest {
  user?: string | JwtPayload;
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

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      reply.code(401).send({ error: 'Invalid token' });
    } else {
      reply.code(401).send({ error: err.message });
    }
  }
};
