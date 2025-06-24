import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.AUTH_PORT ? Number(process.env.AUTH_PORT) : 3005;

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running at http://vault-container:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
