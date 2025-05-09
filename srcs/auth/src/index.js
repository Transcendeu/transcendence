const fastify = require('fastify')({ logger: true });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
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
fastify.post('/register', async (request, reply) => {
  const { username, email, password } = request.body;

  if (!username || !email || !password) {
    return reply.code(400).send({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO USER (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
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

          // First mark any existing auth records as revoked
          db.run('UPDATE AUTH SET revoked = 1 WHERE user_id = ?', [userId], (err) => {
            if (err) {
              reply.code(500).send({ error: 'Error updating old auth records' });
              reject(err);
              return;
            }

            // Then create the new auth record
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
                  user: { id: userId, username, email }
                });
              }
            );
          });
        }
      );
    });
  } catch (error) {
    reply.code(500).send({ error: 'Error processing request' });
  }
});

// Setup 2FA route
fastify.post('/setup-2fa', { preHandler: authenticateToken }, async (request, reply) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Transcendence:${request.user.email}`
    });

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE USER SET two_factor_secret = ? WHERE id = ?',
        [secret.base32, request.user.id],
        (err) => {
          if (err) {
            reply.code(500).send({ error: 'Error saving 2FA secret' });
            reject(err);
            return;
          }

          QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
            if (err) {
              reply.code(500).send({ error: 'Error generating QR code' });
              reject(err);
              return;
            }

            resolve({
              secret: secret.base32,
              qrCode: dataUrl
            });
          });
        }
      );
    });
  } catch (error) {
    reply.code(500).send({ error: 'Error processing request' });
  }
});

// Verify and enable 2FA route
fastify.post('/verify-2fa', { preHandler: authenticateToken }, async (request, reply) => {
  const { token } = request.body;

  if (!token) {
    return reply.code(400).send({ error: 'Token is required' });
  }

  try {
    return new Promise((resolve, reject) => {
      db.get('SELECT two_factor_secret FROM USER WHERE id = ?', [request.user.id], (err, user) => {
        if (err) {
          reply.code(500).send({ error: 'Database error' });
          reject(err);
          return;
        }

        if (!user || !user.two_factor_secret) {
          reply.code(400).send({ error: '2FA not set up' });
          resolve();
          return;
        }

        const verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token
        });

        if (!verified) {
          reply.code(400).send({ error: 'Invalid token' });
          resolve();
          return;
        }

        db.run(
          'UPDATE USER SET two_factor_enabled = 1 WHERE id = ?',
          [request.user.id],
          (err) => {
            if (err) {
              reply.code(500).send({ error: 'Error enabling 2FA' });
              reject(err);
              return;
            }
            resolve({ message: '2FA enabled successfully' });
          }
        );
      });
    });
  } catch (error) {
    reply.code(500).send({ error: 'Error processing request' });
  }
});

// Login route
fastify.post('/login', async (request, reply) => {
  const { username, password, twoFactorToken } = request.body;

  if (!username || !password) {
    return reply.code(400).send({ error: 'Username/Email and password are required' });
  }

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM USER WHERE email = ? OR username = ?', [username, username], async (err, user) => {
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

        // Check if 2FA is enabled
        if (user.two_factor_enabled) {
          if (!twoFactorToken) {
            reply.code(403).send({ error: '2FA token required', requiresTwoFactor: true });
            resolve();
            return;
          }

          const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: twoFactorToken
          });

          if (!verified) {
            reply.code(401).send({ error: 'Invalid 2FA token' });
            resolve();
            return;
          }
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

        // First check if an auth record exists for this user
        db.get('SELECT id FROM AUTH WHERE user_id = ? AND revoked = 0', [user.id], (err, existingAuth) => {
          if (err) {
            reply.code(500).send({ error: 'Error checking existing auth record' });
            reject(err);
            return;
          }

          if (existingAuth) {
            // Update existing auth record
            db.run(
              'UPDATE AUTH SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?',
              [accessToken, refreshToken, expiresAt.toISOString(), existingAuth.id],
              (err) => {
                if (err) {
                  reply.code(500).send({ error: 'Error updating auth record' });
                  reject(err);
                  return;
                }
                resolve({
                  accessToken,
                  refreshToken,
                  user: { id: user.id, username: user.username, email: user.email }
                });
              }
            );
          } else {
            // Create new auth record
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
                  user: { id: user.id, username: user.username, email: user.email }
                });
              }
            );
          }
        });
      } catch (error) {
        reply.code(500).send({ error: 'Error processing request' });
        reject(error);
      }
    });
  });
});

// Refresh token route
fastify.post('/refresh', async (request, reply) => {
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

    const refreshToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return new Promise((resolve, reject) => {
      // First check if an auth record exists for this user
      db.get('SELECT id FROM AUTH WHERE user_id = ? AND revoked = 0', [decoded.id], (err, existingAuth) => {
        if (err) {
          reply.code(500).send({ error: 'Error checking existing auth record' });
          reject(err);
          return;
        }

        if (existingAuth) {
          // Update existing auth record
          db.run(
            'UPDATE AUTH SET access_token = ?, expires_at = ? WHERE id = ?',
            [accessToken, expiresAt.toISOString(), existingAuth.id],
            (err) => {
              if (err) {
                reply.code(500).send({ error: 'Error updating auth record' });
                reject(err);
                return;
              }
              resolve({ accessToken });
            }
          );
        } else {
          // Create new auth record
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
        }
      });
    });
  } catch (error) {
    reply.code(403).send({ error: 'Invalid refresh token' });
  }
});

// Logout route
fastify.post('/logout', { preHandler: authenticateToken }, async (request, reply) => {
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
fastify.get('/me', { preHandler: authenticateToken }, async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, email, two_factor_enabled FROM USER WHERE id = ?', [request.user.id], (err, user) => {
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