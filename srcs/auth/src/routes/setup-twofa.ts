import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../utils/authenticate';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function setup2faRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/setup', { preHandler: authenticateToken }, async (
    request: FastifyRequest & { user?: { id: string; email: string } },
    reply: FastifyReply
  ) => {
    try {
      if (!request.user?.email || !request.user?.id) {
        return reply.code(400).send({ error: 'User not authenticated' });
      }

      // 1) Gera um novo segredo TOTP
      const secret = speakeasy.generateSecret({
        name: `Transcendence:${request.user.email}`
      });

      // 2) Salva o segredo no banco de dados
      const patchRes = await fetch(`${DB_SERVICE_URL}/users/${request.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ two_factor_secret: secret.base32 })
      });

      if (!patchRes.ok) {
        request.log.error('Error saving 2FA secret:', await patchRes.text());
        return reply.code(500).send({ error: 'Failed to save 2FA secret' });
      }

      // 3) Gera o QR Code
      let qrCode: string;
      try {
        qrCode = await QRCode.toDataURL(secret.otpauth_url || '');
      } catch (err) {
        request.log.error('Error generating QR code', err);
        return reply.code(500).send({ error: 'Não foi possível gerar o QR code' });
      }

      // 4) Retorna o segredo e o QR Code
      return reply.send({
        secret: secret.base32,
        qrCode
      });

    } catch (error) {
      request.log.error('Error while setup-2fa:', error);
      return reply.code(500).send({ error: 'Error processing request' });
    }
  });
}
