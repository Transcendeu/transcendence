import jwt from 'jsonwebtoken';
import { Client } from '@litehex/node-vault';

const VAULT_ADDR = process.env.VAULT_ADDR;
const VAULT_TOKEN = process.env.VAULT_TOKEN;

if (!VAULT_ADDR || !VAULT_TOKEN) {
  throw new Error('VAULT_ADDR e VAULT_TOKEN devem estar definidos nas variáveis de ambiente');
}

const client = new Client({
  apiVersion: 'v1',
  endpoint: VAULT_ADDR,
  token: VAULT_TOKEN,
});

interface VaultResponseData {
  value: string;
}

async function getSecretFromVault(secretPath: string): Promise<string> {
  const response = await client.kv2.read({
    mountPath: 'secret',
    path: secretPath,
  });

  console.log('Resposta do Vault:', JSON.stringify(response, null, 2));

  const secretData = response?.data?.data?.data as VaultResponseData | undefined;

  if (!secretData || !secretData.value) {
    throw new Error(`Segredo não encontrado no Vault em secret/${secretPath}`);
  }

  return secretData.value;
}

export async function getAccessSigningKey(): Promise<string> {
  const keyName = process.env.JWT_KEY;
  if (!keyName) throw new Error('Variável JWT_KEY não definida');
  return getSecretFromVault(keyName);
}


export async function getRefreshSigningKey(): Promise<string> {
  const keyName = process.env.JWT_REFRESH_KEY;
  if (!keyName) throw new Error('Variável JWT_REFRESH_KEY não definida');
  return getSecretFromVault(keyName);
}

export async function signJwt(payload: object): Promise<string> {
  const signingKey = await getAccessSigningKey();
  return jwt.sign(payload, signingKey, { algorithm: 'HS256', expiresIn: '15m' });
}

export async function signRefreshJwt(payload: object): Promise<string> {
  const signingKey = await getRefreshSigningKey();
  return jwt.sign(payload, signingKey, { algorithm: 'HS256', expiresIn: '7d' });
}

export async function verifyJwt(token: string): Promise<object> {
  const signingKey = await getAccessSigningKey();
  return jwt.verify(token, signingKey, { algorithms: ['HS256'] }) as object;
}

export async function verifyRefreshJwt(token: string): Promise<object> {
  const signingKey = await getRefreshSigningKey();
  return jwt.verify(token, signingKey, { algorithms: ['HS256'] }) as object;
}

export async function refreshJwt(token: string): Promise<string> {
  const refreshSigningKey = await getRefreshSigningKey();

  try {
    const decoded = jwt.verify(token, refreshSigningKey, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    }) as object;

    const { iat, exp, nbf, ...payload } = decoded as any;

    return signJwt(payload);
  } catch (err) {
    throw new Error('Token inválido para refresh');
  }
}
