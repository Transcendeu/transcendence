import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.AUTH_PORT ? Number(process.env.AUTH_PORT) : 4001;

const start = async () => {
  const server_host = '0.0.0.0';
  try {
    await app.listen({ port: PORT, host: server_host });
    console.log(`Server running at ${server_host}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
