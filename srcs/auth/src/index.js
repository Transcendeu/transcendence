const fastify = require('fastify')({ logger: true });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { db, initDatabase } = require('./database/init');
const { OAuth2Client } = require('google-auth-library');
const fastifyCookie = require('fastify-cookie');
const fs = require('fs');

// Initialize database
initDatabase().catch(console.error);

// CORS configuration
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

fastify.register(fastifyCookie);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALLBACK_URL || 'http://localhost/api/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Missing required Google OAuth credentials');
  process.exit(1);
}

const oAuth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Authentication middleware
const authenticateToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new Error('Access token required');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      reply.code(401).send({ error: 'Invalid token' });
    } else {
      reply.code(401).send({ error: err.message });
    }
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
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
          );

          const refreshToken = jwt.sign(
            { id: userId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
          );

          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 15);

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
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

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

  if (!process.env.JWT_REFRESH_SECRET) {
    return reply.code(500).send({ error: 'JWT_REFRESH_SECRET environment variable is not set' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if the refresh token is revoked
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM AUTH WHERE user_id = ? AND refresh_token = ? AND revoked = 0', 
        [decoded.id, refreshToken], 
        (err, existingAuth) => {
          if (err) {
            reply.code(500).send({ error: 'Error checking existing auth record' });
            reject(err);
            return;
          }

          if (!existingAuth) {
            reply.code(401).send({ error: 'Refresh token has been revoked' });
            resolve();
            return;
          }

          const newAccessToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
          );

          const newRefreshToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
          );

          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 15);

          // Update the auth record with new tokens
          db.run(
            'UPDATE AUTH SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?',
            [newAccessToken, newRefreshToken, expiresAt.toISOString(), existingAuth.id],
            (err) => {
              if (err) {
                reply.code(500).send({ error: 'Error updating auth record' });
                reject(err);
                return;
              }
              resolve({ 
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
              });
            }
          );
        }
      );
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Refresh token has expired' });
    } else if (error.name === 'JsonWebTokenError') {
      reply.code(401).send({ error: 'Invalid refresh token' });
    } else {
      reply.code(500).send({ error: 'Error processing refresh token' });
    }
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

fastify.get('/google', async (request, reply) => {
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'consent',
  });
  reply.redirect(url);
});

// Update the Google callback route to handle errors better
fastify.get('/google/callback', async (request, reply) => {
  console.log('Received Google callback with query:', request.query);
  const code = request.query.code;
  if (!code) {
    console.error('No code provided in callback');
    return reply.code(400).send('No code provided');
  }

  try {
    console.log('Getting tokens from Google...');
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    console.log('Getting user info from Google...');
    const userInfoRes = await oAuth2Client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });
    const user = userInfoRes.data;
    console.log('Got user info:', user);
    
    // Find or create user in DB
    return new Promise(async (resolve, reject) => {
      db.get('SELECT * FROM USER WHERE email = ?', [user.email], async (err, dbUser) => {
        if (err) {
          console.error('Database error:', err);
          return reply.code(500).send({ error: 'Database error' });
        }

        let userId = dbUser && dbUser.id;
        if (!dbUser) {
          console.log('Creating new user...');
          // Create new user with random password
          const randomPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          db.run(
            'INSERT INTO USER (username, email, password, status) VALUES (?, ?, ?, ?)',
            [user.name || user.email, user.email, hashedPassword, 'online'],
            async function (err) {
              if (err) {
                console.error('Error creating user:', err);
                return reply.code(500).send({ error: 'Error creating user' });
              }
              userId = this.lastID;
              console.log('New user created with ID:', userId);
              await issueJwtAndRedirect(userId, user.email, user.name || user.email, reply);
              resolve();
            }
          );
        } else {
          console.log('Updating existing user:', dbUser);
          // Update user status to online
          db.run(
            'UPDATE USER SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            ['online', userId],
            async (err) => {
              if (err) {
                console.error('Error updating user status:', err);
              }
              await issueJwtAndRedirect(userId, user.email, dbUser.username, reply);
              resolve();
            }
          );
        }
      });
    });
  } catch (e) {
    console.error('Google OAuth error:', e);
    if (e.message.includes('invalid_grant')) {
      // If the code has already been used, redirect to login
      return reply.redirect('/login');
    }
    return reply.code(500).send({ error: 'Google OAuth error', details: e.message });
  }
});

async function issueJwtAndRedirect(userId, email, username, reply) {
  console.log('Issuing JWT and redirecting for user:', { userId, email, username });
  
  // Create tokens
  const accessToken = jwt.sign(
    { id: userId, email, username },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Create user data object
  const userData = {
    id: userId,
    email,
    username,
    status: 'online',
    accessToken,
    refreshToken
  };
  
  // Use URL-safe base64 encoding
  const encodedData = Buffer.from(JSON.stringify(userData))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  console.log('Redirecting with data:', userData);
  const redirectUrl = `/?data=${encodedData}`;
  console.log('Redirect URL:', redirectUrl);

  // Store the auth record in the database
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  try {
    // First mark any existing auth records as revoked
    await new Promise((resolve, reject) => {
      db.run('UPDATE AUTH SET revoked = 1 WHERE user_id = ?', [userId], (err) => {
        if (err) {
          console.error('Error updating old auth records:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });

    // Then create the new auth record
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO AUTH (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
        [userId, accessToken, refreshToken, expiresAt.toISOString()],
        (err) => {
          if (err) {
            console.error('Error creating auth record:', err);
            reject(err);
            return;
          }
          resolve();
        }
      );
    });

    // Set cookies for SPA
    reply.setCookie('access_token', accessToken, { 
      path: '/', 
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    reply.setCookie('refresh_token', refreshToken, { 
      path: '/', 
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Send the redirect response
    return reply.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in issueJwtAndRedirect:', error);
    return reply.code(500).send({ error: 'Error processing authentication' });
  }
}

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