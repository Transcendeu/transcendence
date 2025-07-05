import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { oAuth2Client } from '../utils/g-client';
import { signJwt, signRefreshJwt } from '../utils/jwt';

const DB_URL = process.env.DATABASE_URL || 'http://database:5000';

interface GoogleCallbackQuery {
  code?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  two_factor_enabled?: boolean;
}

export async function googleCallbackRoute(fastify: FastifyInstance) {
  fastify.get('/callback', async (
      request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
      reply: FastifyReply
    ) => {
      const code = request.query.code;
      if (!code) {
        return reply.code(400).send('No code provided');
      }

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        const userInfoRes = await oAuth2Client.request({
          url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        });
        const userInfo = userInfoRes.data as {
          email: string;
          name?: string;
        };

        let userId: string | undefined;
        let username: string | undefined;
        let twoFactorEnabled = false;

        try {
          const resp = await fetch(
            `${DB_URL}/users?emailOrUsername=${encodeURIComponent(userInfo.email)}`
          );
          if (resp.ok) {
            const existingUser = (await resp.json()) as User;
            if (existingUser.id) {
              userId = existingUser.id;
              username = existingUser.username;
              twoFactorEnabled = !!existingUser.two_factor_enabled;
            }
          } else if (resp.status !== 404) {
            throw new Error(`Unexpected response ${resp.status}`);
          }
        } catch (err) {
          throw err;
        }

        if (!userId) {
          const baseUsername = userInfo.name || userInfo.email.split('@')[0];
          let uniqueUsername = baseUsername;
          let counter = 1;

          while (true) {
            try {
              const conflictResp = await fetch(
                `${DB_URL}/users?emailOrUsername=${encodeURIComponent(uniqueUsername)}`
              );
              if (conflictResp.status === 404) {
                break;
              }
              if (!conflictResp.ok) {
                throw new Error(`Error checking username uniqueness: ${conflictResp.status}`);
              }
              const conflictUser = (await conflictResp.json()) as User;
              if (!conflictUser.id) break;
              uniqueUsername = `${baseUsername}${counter++}`;
            } catch (conflictErr) {
              if ((conflictErr as any).response?.status === 404) break;
              throw conflictErr;
            }
          }

          const createResp = await fetch(`${DB_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: uniqueUsername,
              email: userInfo.email,
              password: 'google-auth',
            }),
          });
          if (!createResp.ok) {
            throw new Error('Failed to create new user');
          }
          const newUser = (await createResp.json()) as User;
          userId = newUser.id;
          username = newUser.username;
        }

        if (twoFactorEnabled) {
          const tempToken = await signJwt({ id: userId, email: userInfo.email, temp: true });
          const redirectData = {
            requiresTwoFactor: true,
            tempToken,
            email: userInfo.email,
            username,
          };
          const base64Data = Buffer.from(JSON.stringify(redirectData)).toString('base64');
          return reply.redirect(`/?data=${base64Data}`);
        }

        const accessToken = await signJwt({ id: userId, email: userInfo.email, username: username });
        const refreshToken = await signRefreshJwt({ id: userId });
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        const authTokenResp = await fetch(`${DB_URL}/auth-tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            auth_provider: 'google',
          }),
        });
        if (!authTokenResp.ok) {
          throw new Error('Failed to save auth tokens');
        }

        const userData = {
          id: userId,
          email: userInfo.email,
          username,
          status: 'online',
          accessToken,
          refreshToken,
        };
        const base64Data = Buffer.from(JSON.stringify(userData)).toString('base64');
        return reply.redirect(`/?data=${base64Data}`);
      } catch (err: any) {
        fastify.log.error('Google OAuth error:', err.toString());
        if (err.response && err.response.status === 404) {
          return reply.code(401).send({ error: 'User lookup failed' });
        }
        if (err.message && err.message.includes('invalid_grant')) {
          return reply.redirect('/login');
        }
        return reply.code(500).send({ error: 'Google OAuth error', details: err.toString() });
      }
    }
  );
}
