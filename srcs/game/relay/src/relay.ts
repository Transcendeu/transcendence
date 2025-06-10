import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import net from 'net';
import type WSSocket from 'ws';
import uuid from 'uuid-random';

interface Client {
  socket?: WSSocket;
  role: 'player1' | 'player2' | 'spectator';
  ready: boolean;
  name?: string;
}

interface Session {
  id: string;
  clients: Set<Client>;
  engineSocket: net.Socket;
  buffer: string;
  localGame: boolean;
  player1Name?: string;
  player2Name?: string;
}

const fastify = Fastify();
await fastify.register(fastifyWebsocket);

const sessions = new Map<string, Session>();
const nameToSession = new Map<string, string>();


function connectToEngine(gameId: string, isLocal: boolean) {
  const engineSocket = net.createConnection({ host: 'engine', port: 1337 }, () => {
    engineSocket.write(`${gameId}\n`);
  });

  const session: Session = {
    id: gameId,
    clients: new Set(),
    engineSocket,
    buffer: '',
    localGame: isLocal
  };

  if (isLocal) {
    injectLocalPlayer(session, gameId);
  }

  sessions.set(gameId, session);

  engineSocket.on('data', (chunk) => {
    session.buffer += chunk.toString();
    let index;
    while ((index = session.buffer.indexOf('\n')) !== -1) {
      const line = session.buffer.slice(0, index);
      session.buffer = session.buffer.slice(index + 1);
      try {
        const obj = JSON.parse(line);

        if (obj.type === 'game_end') {
          // Notify all clients and close connections
          for (const client of session.clients) {
            if (isConnectedClient(client)) {
              client.socket.send(JSON.stringify(obj));
              setTimeout(() => {
                client.socket.close(1000, 'Game ended'); // Normal closure
              }, 100);
            }
          }
          // Clean up session after short delay
          setTimeout(() => {
            session.engineSocket.end();
            sessions.delete(session.id);
            nameToSession.delete(session.player1Name!);
            nameToSession.delete(session.player2Name!);
          }, 500);
          continue; // Skip normal processing
        }

        for (const client of session.clients) {
          if (obj.type === 'state') {
            if (isLocal) {
              obj.playerNames = {
                player1: 'Player 1',
                player2: 'Player 2'
              };
            } else {
              obj.playerNames = {
                player1: session.player1Name ?? '',
                player2: session.player2Name ?? ''
              };
            }
          }

          for (const client of session.clients) {
            if (isConnectedClient(client)) {
              client.socket.send(JSON.stringify(obj));
            }
          }
        }
      } catch {
        console.warn(`Bad data: ${line}`);
      }
    }
  });

  engineSocket.on('end', () => {
    console.warn(`Engine socket closed for ${gameId}`);
    sessions.delete(gameId);
  });

  engineSocket.on('error', (err) => {
    console.error(`Engine error (${gameId}):`, err.message);
  });
}


// ✅ POST /session - Create a new session
fastify.post('/session', async (req, reply) => {
  const body = await req.body as { name: string, isLocal: boolean };

  if (!body?.name || typeof body.name !== 'string') {
    return reply.code(400).send({ error: 'Name is required' });
  }

  // Look for an existing session with this player
  for (const session of sessions.values()) {
    for (const client of session.clients) {
      if (client.name === body.name) {
        return reply.send({ gameId: session.id });
      }
    }
  }

  // Create a new session
  const gameId = uuid();
  connectToEngine(gameId, body.isLocal);
  reply.send({ gameId });
});

fastify.get<{ Params: { name: string } }>('/session/by-name/:name', async (req, reply) => {
  const gameId = nameToSession.get(decodeURIComponent(req.params.name));
  if (!gameId || !sessions.has(gameId)) return reply.code(404).send({ error: 'Session not found' });

  const session = sessions.get(gameId)!;
  
  const players = [];
  let isSpectator = false;
  
  for (const client of session.clients) {
    if ((client.role === 'player1' || client.role === 'player2') && client.name) {
      players.push(client.name);
    } else if (client.role === 'spectator' && client.name === decodeURIComponent(req.params.name)) {
      isSpectator = true;
    }
  }
  
  reply.send({ 
    gameId: session.id,
    local: session.localGame,
    players,
    isSpectator
  });
});

// ✅ GET /session/:id - Get status
fastify.get<{Params: { id: string }}>('/session/:id', async (req, reply) => {
  const session = sessions.get(req.params.id);
  if (!session) return reply.code(404).send({ error: 'Session not found' });

  const players: { player1?: string; player2?: string; spectators: string[] } = { spectators: [] };

  for (const client of session.clients) {
    if ((client.role === 'player1' || client.role === 'player2') && client.name) {
      players[client.role] = client.name;
    } else if (client.role === 'spectator' && client.name) {
      players.spectators.push(client.name);
    }
  }

  reply.send({ gameId: session.id, players });
});

// ✅ GET /ws/:gameId - Join via WebSocket
fastify.get<{Params: { gameId: string }}>('/ws/:gameId', { websocket: true }, (socket, request) => {
  const gameId = request.params.gameId;
  let session = sessions.get(gameId);

  if (!session) {
  //    connectToEngine(gameId, false);//here?
  //    session = sessions.get(gameId)!;
    return socket.close(1008, 'Session not found'); // 1008 = policy violation
  }

  const client: Client = {
    socket,
    role: 'spectator',
    name: undefined,
    ready: false
  };

  session.clients.add(client);

  socket.on('message', (msg: string) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    if (data.type === 'join' && typeof data.name === 'string') {
      client.name = data.name;
      const requestedRole = ['player1', 'player2'].includes(data.role) ? data.role : 'spectator';
      const rolesTaken = new Set(Array.from(session.clients).map(c => c.role));

      const existing = Array.from(session.clients).find(c => c.name === client.name && c !== client);
      if (existing) {
        client.role = existing.role;
      } else if (!rolesTaken.has(requestedRole)) {
        client.role = requestedRole as 'player1' | 'player2' | 'spectator';
      } else {
        client.role = 'spectator';
      }
      nameToSession.set(client.name!, session.id);
      console.log(`[Join] ${client.name} assigned role: ${client.role}`);

      if (client.role === 'player1') session.player1Name = client.name;
      if (client.role === 'player2') session.player2Name = client.name;

      if (bothPlayersConnected(session)) {
//        console.log(`Both players connected for session ${session.id}. Sending 'players_ready' to engine.`);
        session.engineSocket.write(JSON.stringify({ type: 'ready' }) + '\n');
      }
    }



  if (client.role === 'player1' || client.role === 'player2') {
      if (data.type !== 'input') console.log(`[Relay] Forwarding to engine:(${data.type})`, msg.toString());//logging to implement
      if (['input', 'ready', 'pause', 'resume', 'forfeit', 'space'].includes(data.type)) {
        const inputPayload = {
          player: client.name,
          type: data.type,
          role: session.localGame ? data.role : client.role,
          input: normalizeInput(data.type, data.input),
          state: data.state
        };
        session.engineSocket.write(JSON.stringify(inputPayload) + '\n');
      }
  }

  });

  socket.on('close', () => {
    console.log(`${client.name} disconnected.`);
    client.socket = undefined;
    client.ready = false;

    const session = sessions.get(gameId);
    if (!session || session.engineSocket.destroyed) return;

      if (client.role === 'player1' || client.role === 'player2') {
        if (!bothPlayersConnected(session)) {
          console.log(`Player disconnected from session ${session.id}. Sending 'pause' to engine.`);
          session.engineSocket.write(JSON.stringify({ type: 'pause' }) + '\n');
        }

        const activePlayers = [...session.clients].filter(c => 
          isConnectedClient(c) && (c.role === 'player1' || c.role === 'player2'));

        if (activePlayers.length === 0) {
          console.log(`No players left in session ${session.id}, cleaning up spectators`);
          for (const client of session.clients) {
            if (isConnectedClient(client) && client.role === 'spectator') {
              client.socket.close(1000, 'Game ended - no players remaining');
            }
          }
        }
      }

    // If no active sockets are left in the session, start a cleanup timer
    if (![...session.clients].some(isConnectedClient)) {
      setTimeout(() => {
        if ([...session.clients].every(c => !c.socket?.readyState)) {
          console.log(`Cleaning up empty session ${session.id}`);
          session.engineSocket.end();
          sessions.delete(session.id);
          nameToSession.delete(session.player1Name!);
          nameToSession.delete(session.player2Name!);
        }
      }, 30000);
    }
  });

});

// PATCH /session/:id/local-mode
fastify.patch<{ Params: { id: string }, Body: { local: boolean } }>('/session/:id/local-mode', async (req, reply) => {
  const session = sessions.get(req.params.id);
  if (!session) return reply.code(404).send({ error: 'Session not found' });
  session.localGame = req.body.local;
  reply.send({ ok: true });
});

await fastify.listen({ port: 3333, host: '0.0.0.0' });
console.log('WS Relay running on :3333');

function normalizeInput(dataType: string, input: string): string {
  if (dataType !== 'input') return input;
  if (input === 'w' || input === 'ArrowUp') return 'up';
  if (input === 's' || input === 'ArrowDown') return 'down';
  return input;
}

function isConnectedClient(client: Client): client is Client & { socket: WSSocket } {
  return !!client.socket && client.socket.readyState === client.socket.OPEN;
}

function bothPlayersConnected(session: Session): boolean {
  if (session.localGame) {
    return [...session.clients].some(client => 
      isConnectedClient(client) && client.role === 'player1');
  }

  let player1Connected = false;
  let player2Connected = false;

  for (const client of session.clients) {
    if (!isConnectedClient(client)) continue;
    if (client.role === 'player1') player1Connected = true;
    if (client.role === 'player2') player2Connected = true;
  }
  return player1Connected && player2Connected;
}

function injectLocalPlayer(session: Session, localPlayer: string) {

    const localClient: Client = {
      name: localPlayer,
      role: 'player2',
      ready: true,
    };

    session.player2Name = localPlayer;
    session.clients.add(localClient);

    setTimeout(() => {
      session.engineSocket.write(JSON.stringify({ type: 'ready' }) + '\n');
      console.log(`[Local] Auto-started local match with ${localPlayer}`);
    }, 50); // slight delay just to ensure engine is ready
}
