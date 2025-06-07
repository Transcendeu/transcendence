import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const start = async () => {
  try {
    await app.listen({ port: PORT });
    console.log(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
