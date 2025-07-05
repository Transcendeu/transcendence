import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import speakeasy from 'speakeasy';
import { signJwt, signRefreshJwt, verifyJwt } from '../utils/jwt';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

interface VerifyGoogle2faBody {
  tempToken?: string;
  twoFactorToken?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  two_factor_secret?: string;
}

export async function google2faVerifyRoute(fastify: FastifyInstance) {
  fastify.post('/verify', async (
      request: FastifyRequest<{ Body: VerifyGoogle2faBody }>,
      reply: FastifyReply
    ) => {
      const { tempToken, twoFactorToken } = request.body;

      if (!tempToken || !twoFactorToken) {
        return reply.code(400).send({ error: 'Missing required tokens' });
      }

      // 1) Verifica assinatura do tempToken
      let decoded: { email: string; id: string };
      try {
        decoded = await verifyJwt(tempToken) as { email: string; id: string };
      } catch (err) {
        return reply.code(400).send({ error: 'Invalid temporary token' });
      }

      // 2) Busca usuário no database-service via fetch
      let user: User;
      try {
        const resp = await fetch(
          `${DB_SERVICE_URL}/users?emailOrUsername=${encodeURIComponent(decoded.email)}`
        );
        if (resp.status === 404) {
          return reply.code(400).send({ error: '2FA not set up' });
        }
        if (!resp.ok) {
          throw new Error('Failed to fetch user');
        }
        const users = await resp.json();
        user = Array.isArray(users) ? users[0] : users;
      } catch (err) {
        request.log.error('Error fetching user for Google 2FA:', err);
        return reply.code(500).send({ error: 'User lookup failed' });
      }

      // 3) Verifica se existe secret
      if (!user.two_factor_secret) {
        return reply.code(400).send({ error: '2FA not set up' });
      }

      // 4) Validação do TOTP
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorToken,
      });
      if (!verified) {
        return reply.code(401).send({ error: 'Invalid 2FA token' });
      }

      // 5) Gera os tokens finais
      const accessToken = await signJwt({ id: user.id, email: user.email, username: user.username });
      const refreshToken = await signRefreshJwt({ id: user.id });
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // 6) Persiste no database-service usando fetch POST
      try {
        const postResp = await fetch(`${DB_SERVICE_URL}/auth-tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            auth_provider: 'google',
          }),
        });
        if (!postResp.ok) {
          throw new Error('Failed to save auth record');
        }
      } catch (err) {
        request.log.error('Error creating auth record for Google 2FA:', err);
        return reply.code(500).send({ error: 'Error saving auth record' });
      }

      // 7) Retorna os dados
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        status: 'online',
        accessToken,
        refreshToken,
      };
    }
  );
}
