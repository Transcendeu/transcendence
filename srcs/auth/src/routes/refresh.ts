import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

interface AuthTokenRecord {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  revoked: boolean;
  auth_provider: string;
}

export async function refreshRoute(fastify: FastifyInstance) {
  fastify.post('/refresh', async (
    request: FastifyRequest<{ Body: { refreshToken?: string } }>,
    reply: FastifyReply
  ) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.code(401).send({ error: 'Refresh token required' });
    }

    if (!process.env.JWT_REFRESH_SECRET) {
      return reply.code(500).send({ error: 'JWT_REFRESH_SECRET environment variable is not set' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return reply.code(401).send({ error: 'Refresh token has expired' });
      }
      if (err.name === 'JsonWebTokenError') {
        return reply.code(401).send({ error: 'Invalid refresh token' });
      }
      return reply.code(500).send({ error: 'Error processing refresh token' });
    }

    try {
      // 2) Busca o registro ativo no database-service
      const queryParams = new URLSearchParams({
        user_id: decoded.id,
        refresh_token: refreshToken,
        revoked: 'false'
      });

      const res = await fetch(`${DB_SERVICE_URL}/auth-tokens?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        request.log.error('Error fetching auth-tokens:', await res.text());
        return reply.code(500).send({ error: 'Error checking existing auth record' });
      }

      const authRecords: AuthTokenRecord[] = await res.json();

      if (!authRecords.length) {
        return reply.code(401).send({ error: 'Refresh token has been revoked or not found' });
      }

      const authId = authRecords[0].id;

      // 3) Gera novos tokens
      const newAccessToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' }
      );
      const newRefreshToken = jwt.sign(
        { id: decoded.id },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: '7d' }
      );

      const newExpiresAt = new Date();
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + 15);

      // 4) Atualiza o registro no database-service
      const patchRes = await fetch(`${DB_SERVICE_URL}/auth-tokens/${authId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: newExpiresAt.toISOString()
        })
      });

      if (!patchRes.ok) {
        request.log.error('Error updating auth record:', await patchRes.text());
        return reply.code(500).send({ error: 'Error saving new tokens' });
      }

      // 5) Retorna os novos tokens
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };

    } catch (err) {
      request.log.error('Error processing refresh token:', err);
      return reply.code(500).send({ error: 'Error processing refresh token' });
    }
  });
}
