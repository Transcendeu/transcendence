export async function createGameSession(name: string | null, isLocal: boolean): Promise<string> {
  const res = await fetch('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, isLocal }),
  });

  const json = await res.json();
  return json.gameId;
}

export async function checkPlayerMatch(name: string): Promise<{ gameId: string, local: boolean, players: string[], isSpectator: boolean } | null> {
  try {
    const encodedName = encodeURIComponent(name);
    const res = await fetch(`/session/by-name/${encodedName}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
