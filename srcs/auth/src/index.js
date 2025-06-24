const fastify = require('fastify')({ logger: true });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const fastifyCookie = require('fastify-cookie');
const fs = require('fs');
const axios = require('axios');
const DB_URL = process.env.DATABASE_URL || 'http://database:5000';
const api = axios.create({
  baseURL: process.env.DATABASE_URL || 'http://database:5000',
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

fastify.register(require('@fastify/cors'), {
  origin: DB_URL,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
});
// fastify.register(fastifyCookie);

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
)

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
    // The password is already hashed from the frontend, so we'll hash it again with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1) Cria usuário no DB-service
    const { data: newUser } = await api.post('/users', {
      username,
      email,
      password: hashedPassword
    });
    
    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: newUser.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

     // 2) Gera tokens localmente
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 3) Persiste tokens no DB-service
    await api.post('/auth-tokens', {
      user_id:       newUser.id,
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_at:    expiresAt,
      auth_provider: 'local'
    });
    return { accessToken, refreshToken, user: newUser };
  } catch (err) {
    // trata erros da API de DB
    if (err.response && err.response.status === 400) {
      return reply.code(400).send({ error: err.response.data.error });
    }
    reply.code(500).send({ error: 'Error processing request' });
  }
});

// Setup 2FA route
fastify.post('/setup-2fa', { preHandler: authenticateToken }, async (request, reply) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Transcendence:${request.user.email}`
    });

    await api.patch(`/users/${request.user.id}`, {
      two_factor_secret: secret.base32
    });

    let qrCode;
    try {
      qrCode = await QRCode.toDataURL(secret.otpauth_url);
    } catch (err) {
      request.log.error('Error generating QR code', err);
      return reply.code(500).send({ error: 'Não foi possível gerar o QR code' });
    }

    return { secret: secret.base32, qrCode };
  } catch (error) {
    request.log.error('Error while setup-2fa:', error);
    return reply.code(500).send({ error: 'Error processing request' });
  }
});

// Verify and enable 2FA route
fastify.post('/verify-2fa', { preHandler: authenticateToken }, async (request, reply) => {
  const { token } = request.body;

  if (!token) {
    return reply.code(400).send({ error: 'Token is required' });
  }

  // 1) Busca o usuário, tratando 404 / outros erros
  let user;
  try {
    const resp = await api.get('/users', {
      params: { emailOrUsername: request.user.email }
    });
    user = resp.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return reply.code(400).send({ error: '2FA not set up' });
    }
    request.log.error('Database error on GET /users:', err);
    return reply.code(500).send({ error: 'Error on user service' });
  }

  // 2) Verifica se há secret
  if (!user.two_factor_secret) {
    return reply.code(400).send({ error: '2FA não configurado' });
  }

  // 3) Busca o usuário para obter two_factor_secret
  const verified = speakeasy.totp.verify({
    secret:   user.two_factor_secret,
    encoding: 'base32',
    token
  });

  // 4) Verifica o código TOTP
  if (!verified) {
    return reply.code(401).send({ error: 'Invalid token' });
  }

  // 5) Tenta habilitar o 2FA no DB
  try {
    await api.patch(`/users/${request.user.id}`, {
      two_factor_enabled: 1
    });
  } catch (err) {
    request.log.error('Error enabling 2FA:', err);
    return reply
      .code(err.response?.status || 500)
      .send({ error: 'Não foi possível habilitar o 2FA' });
  }


    return { message: '2FA enabled successfully'};
});

// Login route
fastify.post('/login', async (request, reply) => {
  const { username, password, twoFactorToken } = request.body;

  if (!username || !password) {
    return reply.code(400).send({ error: 'Username/Email and password are required' });
  }

  try {
    // 1) Busca o usuário no DB-service
    const { data: user } = await api.get('/users', {
      params: { emailOrUsername: username }
    });

    // 2) Confere senha (bcrypt)
    // The password is already hashed from the frontend, so we'll compare it with the stored hash
    const valid = await bcrypt.compare(password, user.password); //user.passwordHash
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // 3) 2FA (se habilitado)
    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        return reply.code(403).send({ error: '2FA token required', requiresTwoFactor: true });
      }
      const verified = speakeasy.totp.verify({
        secret:   user.two_factor_secret,
        encoding: 'base32',
        token:    twoFactorToken
      });
      if (!verified) {
        return reply.code(401).send({ error: 'Invalid 2FA token' });
      }
    }

    // 4) Gera novos tokens
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

    // 5) Persiste (update ou insert) no DB-service
    // Tenta primeiro atualizar; se 404, insere novo
    try {
      await api.patch(`/auth-tokens/${user.id}`, {
        access_token:  accessToken,
        refresh_token: refreshToken,
        expires_at:    expiresAt
      });
    } catch (patchErr) {
      // se não encontrou, cria
      await api.post('/auth-tokens', {
        user_id:       user.id,
        access_token:  accessToken,
        refresh_token: refreshToken,
        expires_at:    expiresAt,
        auth_provider: 'local'
      });
    }

    return { accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } };

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    reply.code(500).send({ error: 'Error processing request' });
  }
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

  // 1) Verifica assinatura do JWT de refresh
  let decoded;
  try {
   decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send({ error: 'Refresh token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
    return reply.code(500).send({ error: 'Error processing refresh token' });
  }

  // 2) Busca o registro ativo no database-service
  let authRecords;
  try {
    const resp = await api.get('/auth-tokens', {
      params: {
        user_id:       decoded.id,
        refresh_token: refreshToken,
        revoked:       false
      }
    });
    authRecords = resp.data;
  } catch (err) {
    request.log.error('Error fetching auth-tokens:', err);
    return reply.code(500).send({ error: 'Error checking existing auth record' });
  }

  if (!authRecords.length) {
    return reply.code(401).send({ error: 'Refresh token has been revoked or not found' });
  }

  const authId = authRecords[0].id;

  // 3) Gera novos tokens
  const newAccessToken  = jwt.sign(
    { id: decoded.id, email: decoded.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const newRefreshToken = jwt.sign(
    { id: decoded.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  const newExpiresAt = new Date();
  newExpiresAt.setMinutes(newExpiresAt.getMinutes() + 15);

  // 4) Atualiza o registro no database-service
  try {
    await api.patch(`/auth-tokens/${authId}`, {
      access_token:  newAccessToken,
      refresh_token: newRefreshToken,
      expires_at:    newExpiresAt
    });
  } catch (err) {
    request.log.error('Error updating auth record:', err);
    return reply.code(500).send({ error: 'Error saving new tokens' });
  }

  // 5) Retorna os novos tokens
  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken
  };
});

// Logout route
fastify.post('/logout', { preHandler: authenticateToken }, async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      return reply.code(400).send({ error: 'Access token is required' });
    }

    const { data: authRecords } = await api.get('/auth-tokens', {
      params: { access_token: accessToken }
    });

    if (authRecords.length === 0) {
      return reply.code(404).send({ error: 'Error revoking token' });
    }

    const authId = authRecords[0].id;
    await api.patch(`/auth-tokens/${authId}`, { revoked: 1 });

    return { message: 'Logged out successfully' };
  } catch (err) {
    request.log.error('Logout error:', err);
    return reply.code(500).send({ error: 'Unable to log out' });
  }
});

// Get current user route
fastify.get('/me', { preHandler: authenticateToken }, async (request, reply) => {
  try {
    // 1) Busca o usuário no database-service usando o e-mail do token
    const { data: user } = await api.get('/users', {
      params: { emailOrUsername: request.user.email }
    });

    // 2) Se não vier nenhum usuário, devolve 404
    if (!user || !user.id) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // 3) Retorna somente os campos que interessam
    return {
      id:                 user.id,
      username:           user.username,
      email:              user.email,
      twoFactorEnabled:   user.two_factor_enabled
    };

  } catch (err) {
    // 4) Erro de 404 do service de DB → usuário não existe
    if (err.response?.status === 404) {
      return reply.code(404).send({ error: 'User not found' });
    }
    // 5) Outros erros (rede, 5xx…)  
    request.log.error('Error fetching /me:', err);
    return reply.code(500).send({ error: 'Error fetching current user' });
  }
});

// Health check endpoint
fastify.get('/health', async () => {
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
  const code = request.query.code;
  if (!code) {
    return reply.code(400).send('No code provided');
  }
  
  try {
    // 1) Troca o code pelo token do Google
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
  
    // 2) Pega informações do perfil Google (name, email, picture etc.)
    const userInfoRes = await oAuth2Client.request({
    url: 'https://www.googleapis.com/oauth2/v2/userinfo'
    });
    const userInfo = userInfoRes.data; 
    // userInfo.email, userInfo.name, etc.
  
    let userId;
    let username;
    let twoFactorEnabled = false;
  
    // 3) Tenta buscar o usuário existente no database via e-mail
    try {
      const { data: existingUser } = await axios.get(
        `${DB_URL}/users`,
        { params: { emailOrUsername: userInfo.email } }
      );
      if (existingUser.id) {
        // Usuário já existe: salva id e flags
        userId = existingUser.id;
        username = existingUser.username;
        twoFactorEnabled = existingUser.two_factor_enabled;
      }
    } catch (err) {
      // Se o axios GET retornar 404 (usuário não encontrado), cai aqui.
      // Se for outro erro (500, timeout, etc.), deixa propagar abaixo.
      if (!(err.response && err.response.status === 404)) {
        throw err;
      }
    }
  
    // 4) Se não encontrou usuário (userId ainda indefinido), registramos agora
    if (!userId) {
    // 4.1) Gera um username único baseado no nome do Google
    const baseUsername = userInfo.name || userInfo.email.split('@')[0];
    let uniqueUsername = baseUsername;
    let counter = 1;
  
    // Enquanto existir conflito, adiciona número
    while (true) {
      try {
      const { data: conflict } = await axios.get(
        `${DB_URL}/users`,
        { params: { emailOrUsername: uniqueUsername } }
      );
      if (!conflict.id) break;
      uniqueUsername = `${baseUsername}${counter++}`;
      } catch (conflictErr) {
      // Se o erro for 404 (não encontrado), o nome está livre
      if (conflictErr.response && conflictErr.response.status === 404) {
        break;
      }
      // Se for outro erro, faça throw
      throw conflictErr;
      }
    }
  
    // 4.2) Cria o novo usuário no database. Senha pode ser string fixa ou aleatória,
    // pois o login dele será feito pelo Google depois.
    const { data: newUser } = await axios.post(
      `${DB_URL}/users`,
      {
      username: uniqueUsername,
      email: userInfo.email,
      password: 'google-auth' // placeholder; não será usado no login via Google
      }
    );
  
    userId = newUser.id;
    username = newUser.username;
    // twoFactorEnabled permanece false (não há two_factor_secret ainda)
    }
  
    // 5) Se o usuário tiver 2FA habilitado, geramos um tempToken e redirecionamos para o front
    if (twoFactorEnabled) {
    const tempToken = jwt.sign(
      { id: userId, email: userInfo.email, temp: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    const redirectData = {
      requiresTwoFactor: true,
      tempToken,
      email: userInfo.email,
      username
    };
    const base64Data = Buffer.from(JSON.stringify(redirectData)).toString('base64');
    return reply.redirect(`/?data=${base64Data}`);
    }
  
    // 6) Se não tiver 2FA, geramos tokens finais e salvamos em /auth-tokens
    const accessToken = jwt.sign(
    { id: userId, email: userInfo.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
    );
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  
    await axios.post(
    `${DB_URL}/auth-tokens`,
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      auth_provider: 'google'
    }
    );
  
    // 7) Prepara dados para o frontend e redireciona
    const userData = {
    id: userId,
    email: userInfo.email,
    username,
    status: 'online',
    accessToken,
    refreshToken
    };
    const base64Data = Buffer.from(JSON.stringify(userData)).toString('base64');
    return reply.redirect(`/?data=${base64Data}`);
    
  } catch (err) {
    fastify.log.error('Google OAuth error:', err.toString());
    if (err.response && err.response.status === 404) {
    // Se aqui vier um 404 (“/users” não encontrado por outro motivo),
    // podemos redirecionar para uma página de erro ou tratar como queira.
    return reply.code(401).send({ error: 'User lookup failed' });
    }
    if (err.message && err.message.includes('invalid_grant')) {
    return reply.redirect('/login');
    }
    return reply.code(500).send({ error: 'Google OAuth error', details: err.toString() });
  }
  });

// Add new route to handle 2FA verification for Google login
fastify.post('/verify-google-2fa', async (request, reply) => {
  const { tempToken, twoFactorToken } = request.body;
  if (!tempToken || !twoFactorToken) {
    return reply.code(400).send({ error: 'Missing required tokens' });
  }

  // 1) Verifica assinatura do tempToken
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch (err) {
    return reply.code(400).send({ error: 'Invalid temporary token' });
  }

  // 2) Busca usuário no database-service
  let user;
  try {
    const resp = await api.get('/users', {
      params: { emailOrUsername: decoded.email }
    });
    user = resp.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return reply.code(400).send({ error: '2FA not set up' });
    }
    request.log.error('Error fetching user for Google 2FA:', err);
    return reply.code(500).send({ error: 'User lookup failed' });
  }

  // 3) Verifica se existe secret
  if (!user.two_factor_secret) {
    return reply.code(400).send({ error: '2FA not set up' });
  }

  // 4) Validação do TOTP
  const verified = speakeasy.totp.verify({
    secret:   user.two_factor_secret,
    encoding: 'base32',
    token:    twoFactorToken
  });
  if (!verified) {
    return reply.code(401).send({ error: 'Invalid 2FA token' });
  }

  // 5) Gera os tokens finais
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
  const expiresAt = new Date(Date.now() + 15*60*1000).toISOString();

  // 6) Persiste no database-service
  try {
    await api.post('/auth-tokens', {
      user_id:       user.id,
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_at:    expiresAt,
      auth_provider: 'google'
    });
  } catch (err) {
    request.log.error('Error creating auth record for Google 2FA:', err);
    return reply.code(500).send({ error: 'Error saving auth record' });
  }

  // 7) Retorna os dados
  return {
    id:            user.id,
    email:         user.email,
    username:      user.username,
    status:        'online',
    accessToken,
    refreshToken
  };
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