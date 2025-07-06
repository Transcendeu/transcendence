import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

import { healthRoute } from './routes/health';
import { registerRoute } from './routes/register';
import { loginRoute } from './routes/login';
import { logoutRoute } from './routes/logout';
import { refreshRoute } from './routes/refresh';
import { meRoute } from './routes/me';
import { setup2faRoute } from './routes/setup-twofa';
import { disable2faRoute } from './routes/disable-twofa';
import { verify2faRoute } from './routes/verify-twofa';
import { googleLoginRoute } from './routes/google-login';
import { googleCallbackRoute } from './routes/google-callback';
import { google2faVerifyRoute } from './routes/google-twofa';
import { validateSessionRoute } from './routes/validate-session';

dotenv.config();
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

export const app = Fastify({ logger: true });

app.register(cors, {
  origin: FRONTEND_URL || 'http://localhost:4001', // fallback seguro apenas em dev
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'DNT',
    'User-Agent',
    'If-Modified-Since',
    'Cache-Control',
    'Range'
  ],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  credentials: true
});

// Registra as rotas
app.register(healthRoute, { prefix: '/api/health' });
app.register(registerRoute, { prefix: '/api/auth' });
app.register(loginRoute, { prefix: '/api/auth' });
app.register(logoutRoute, { prefix: '/api/auth' });
app.register(refreshRoute, { prefix: '/api/auth' });
app.register(meRoute, { prefix: '/api/auth' });
app.register(setup2faRoute, { prefix: '/api/auth/2fa' });
app.register(disable2faRoute, { prefix: '/api/auth/2fa' });
app.register(verify2faRoute, { prefix: '/api/auth/2fa' });
app.register(google2faVerifyRoute, { prefix: '/api/auth/google/2fa' });
app.register(googleCallbackRoute, { prefix: '/api/auth/google' });
app.register(googleLoginRoute, { prefix: '/api/auth/google' });
app.register(validateSessionRoute, { prefix: '/api/auth' });
