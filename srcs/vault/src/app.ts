import Fastify from 'fastify';
import { secretsRoutes } from './routes/secrets';

export const app = Fastify({ logger: true });

// Registra as rotas definidas em routes/secrets.ts
app.register(secretsRoutes);
