import { Client } from '@litehex/node-vault';

const endpoint = process.env.VAULT_ADDR;  // || 'http://0.0.0.0:8200';
const token = process.env.VAULT_TOKEN;    // || 'root-token';

const vault = new Client({ endpoint, token });

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
