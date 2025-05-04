const fastify = require('fastify')({ logger: true });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db, initDatabase } = require('./database/init');

// Initialize database
initDatabase().catch(console.error);

// CORS configuration
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// Authentication middleware
const authenticateToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new Error('Access token required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'Invalid token' });
  }
};

// Register route
fastify.post('/api/auth/register', async (request, reply) => {
  const { name, email, password } = request.body;

  if (!name || !email || !password) {
    return reply.code(400).send({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO USER (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashedPassword],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reply.code(400).send({ error: 'Email already exists' });
              reject(err);
              return;
            }
            reply.code(500).send({ error: 'Error creating user' });
            reject(err);
            return;
          }

          const userId = this.lastID;
          const accessToken = jwt.sign(
            { id: userId, email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
          );

          const refreshToken = jwt.sign(
            { id: userId },
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
            { expiresIn: '7d' }
          );

          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 1);

          db.run(
            'INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
            [userId, accessToken, refreshToken, expiresAt.toISOString()],
            (err) => {
              if (err) {
                reply.code(500).send({ error: 'Error creating auth record' });
                reject(err);
                return;
              }
              resolve({
                accessToken,
                refreshToken,
                user: { id: userId, name, email }
              });
            }
          );
        }
      );
    });
  } catch (error) {
    reply.code(500).send({ error: 'Error processing request' });
  }
});

// Login route
fastify.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password are required' });
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM USER WHERE email = ?', [email], async (err, user) => {
      if (err) {
        reply.code(500).send({ error: 'Database error' });
        reject(err);
        return;
      }
      if (!user) {
        reply.code(401).send({ error: 'Invalid credentials' });
        resolve();
        return;
      }

      try {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          reply.code(401).send({ error: 'Invalid credentials' });
          resolve();
          return;
        }

        const accessToken = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
          { expiresIn: '7d' }
        );

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        db.run(
          'INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
          [user.id, accessToken, refreshToken, expiresAt.toISOString()],
          (err) => {
            if (err) {
              reply.code(500).send({ error: 'Error creating auth record' });
              reject(err);
              return;
            }
            resolve({
              accessToken,
              refreshToken,
              user: { id: user.id, name: user.name, email: user.email }
            });
          }
        );
      } catch (error) {
        reply.code(500).send({ error: 'Error processing request' });
        reject(error);
      }
    });
  });
});

// Refresh token route
fastify.post('/api/auth/refresh', async (request, reply) => {
  const { refreshToken } = request.body;

  if (!refreshToken) {
    return reply.code(401).send({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
        [decoded.id, accessToken, refreshToken, expiresAt.toISOString()],
        (err) => {
          if (err) {
            reply.code(500).send({ error: 'Error creating auth record' });
            reject(err);
            return;
          }
          resolve({ accessToken });
        }
      );
    });
  } catch (error) {
    reply.code(403).send({ error: 'Invalid refresh token' });
  }
});

// Logout route
fastify.post('/api/auth/logout', { preHandler: authenticateToken }, async (request, reply) => {
  const authHeader = request.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE AUTH SET revoked = 1 WHERE access_token = ?',
      [token],
      (err) => {
        if (err) {
          reply.code(500).send({ error: 'Error revoking token' });
          reject(err);
          return;
        }
        resolve({ message: 'Logged out successfully' });
      }
    );
  });
});

// Get current user route
fastify.get('/api/auth/me', { preHandler: authenticateToken }, async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, name, email FROM USER WHERE id = ?', [request.user.id], (err, user) => {
      if (err) {
        reply.code(500).send({ error: 'Database error' });
        reject(err);
        return;
      }
      if (!user) {
        reply.code(404).send({ error: 'User not found' });
        resolve();
        return;
      }
      resolve(user);
    });
  });
});

// Health check endpoint
fastify.get('/api/health', async () => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 