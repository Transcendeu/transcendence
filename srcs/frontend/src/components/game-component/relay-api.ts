export async function createGameSession(name: string | null, isLocal: boolean): Promise<string> {
  const token = localStorage.getItem('access_token');

  const res = await fetch('/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ name, isLocal }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status}`);
  }

  const json = await res.json();
  return json.gameId;
}

export async function checkPlayerMatch(name: string): Promise<{ gameId: string, local: boolean, players: string[], isSpectator: boolean } | null> {
  try {
    const token = localStorage.getItem('access_token');
    const encodedName = encodeURIComponent(name);
    const res = await fetch(`/session/by-name/${encodedName}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (res.status === 401) {
      console.warn('Unauthorized access, invalid or expired token');
      return null;
    }

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('checkPlayerMatch failed:', err);
    return null;
  }
}
