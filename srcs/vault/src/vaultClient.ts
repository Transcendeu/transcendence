import { Client } from '@litehex/node-vault';

const vault = new Client({
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN || 'my-root-token',
});

export async function writeSecret(path: string, data: Record<string, any>): Promise<void> {
  await vault.write({
    path: `secret/data/${path}`,
    data: { data },
  });
}

export async function readSecret(path: string): Promise<Record<string, any> | null> {
  try {
    const result = await vault.read({ path: `secret/data/${path}` });
    console.log('Vault read result:', JSON.stringify(result, null, 2));
    return result.data?.data || null;
  } catch (err: any) {
    if (err.response?.statusCode === 404) {
      return null;
    }
    throw err;
  }
}
