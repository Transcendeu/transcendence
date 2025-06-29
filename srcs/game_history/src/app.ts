import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

import { gameRegisterRoute } from './routes/game-register';


dotenv.config();
// const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const FRONTEND_URL = 'http://localhost:4003';

// const FRONTEND_URL = process.env.FRONTEND_URL;

// if (!FRONTEND_URL && process.env.NODE_ENV !== 'development') {
//   throw new Error('FRONTEND_URL is required in production when credentials: true');
// }

export const app = Fastify({ logger: true });

app.register(cors, {
  origin: FRONTEND_URL || 'http://localhost:4003', // fallback seguro apenas em dev
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
app.register(gameRegisterRoute);