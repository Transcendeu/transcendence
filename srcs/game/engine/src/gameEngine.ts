import net, { Socket } from 'net';
import { createInterface } from 'readline';


interface PaddleState {
  x: number;       // normalized 0..1 horizontal position
  y: number;       // normalized 0..1 vertical position (top)
  width: number;   // normalized width
  height: number;  // normalized height
}

interface BallState {
  x: number;       // normalized position 0..1 horizontal
  y: number;       // normalized position 0..1 vertical
  vx: number;      // velocity horizontal (normalized units/frame or per tick)
  vy: number;      // velocity vertical
  radius: number;  // normalized radius
}

interface InputStates {
  player1: {
    up: boolean;
    down: boolean;
    lastUpdate: number; // timestamp
  };
  player2: {
    up: boolean;
    down: boolean;
    lastUpdate: number; // timestamp
  };
}

interface GameState {
  paddles: {
    player1: PaddleState;
    player2: PaddleState;
  };
  ball: BallState;
  scores: {
    player1: number;
    player2: number;
  };
  gameStatus?: 'waiting' | 'playing' | 'paused' | 'queued';
}

interface GameEvent {
  player?: string;
  input: string;
  state: string;
  role?: string;
  type: string;
}

const games = new Map<string, {
  state: GameState;
  inputs: InputStates;
  clients: Set<Socket>;
  interval?: NodeJS.Timeout;
}>();

function handleGameConnection(gameId: string, socket: Socket) {
  let game = games.get(gameId);

  if (!game) {
    console.log(`Creating new game session for ID: ${gameId}`);
    let state = getInitialGameState(0, 0);
    const inputs: InputStates = {
      player1: { up: false, down: false, lastUpdate: Date.now() },
      player2: { up: false, down: false, lastUpdate: Date.now() },
    };
    const clients = new Set<Socket>();
    game = { state, inputs, clients };
    game.state.gameStatus = 'queued';
    games.set(gameId, game);
    
    let lastTime = Date.now();
    //const tenSeconds = 10000;
    const sixtyFps = 1000/60;

    game.interval = setInterval(() => {
      const now = Date.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      // Update paddles with current inputs
    updatePaddles(game!.state, game!.inputs, deltaTime);
    updateBall(game!.state, deltaTime);

      const payload = {
        type: 'state',
        paddles: game!.state.paddles,
        ball: game!.state.ball,
        scores: game!.state.scores,
        gameStatus: game!.state.gameStatus
      };

      const json = JSON.stringify(payload) + '\n';
      for (const client of game!.clients) {
        client.write(json);
      }
    }, sixtyFps);
  }

  game.clients.add(socket);

  const rl = createInterface({ input: socket });

    rl.on('line', (line) => {
    if (!game) return;
//console.log('received line', line);
    try {
      const event: GameEvent = JSON.parse(line);
      //const { player, input, state, role, type } = JSON.parse(line);
      switch (event.type) {
          case 'input': {
            console.log(`Received input: player=${event.player}, input=${event.input}, role= ${event.role} state=${event.state} (${typeof event.state})`);
              if (event.role === 'player1' || event.role === 'player2') {
                if (event.input === 'space') {
                  game.state.gameStatus = 'playing';
                } else if (game.state.gameStatus === 'playing' && isValidInput(event.input) && isValidState(event.state)) {
                  updateInputState(game.inputs, event.role, event.input, event.state);
                }
              }
//              console.log(`[${gameId}] ${role} ${player} -> ${input} (${state})`);
            }
            break;
          case 'ready':
            game.state.gameStatus = 'waiting';
            console.log(`[${gameId}] ${event.role} ${event.player} -> pressed ready)`);
            break;
          case 'pause':
            pausePressed(event, game.state, gameId);
            console.log("there are currently ", game.clients.size, `clients on ${gameId}`);
            break;
          case 'resume':
            console.log(`[${gameId}] ${event.role} ${event.player} -> pressed resume)`);
            break;
          case 'forfeit':
            console.log(`[${gameId}] ${event.role} ${event.player} -> pressed forfeit)`);
            break;
          default:
            console.warn(`[${gameId}] ${event.role} ${event.player} -> sent invalid type ${event.type})`);
            break;
        }
      } catch (err) {
        console.warn(`[${gameId}] Invalid input:`, line);
      }
  });

  socket.on('end', () => {
    game?.clients.delete(socket);
    if (game && game.clients.size === 0) {
      clearInterval(game.interval!);
      games.delete(gameId);
      console.log(`Session ${gameId} ended.`);
    }
  });

  console.log(`Client added to game ${gameId}`);
}

const server = net.createServer((socket) => {
  console.log('Engine got new TCP client');

  const rl = createInterface({ input: socket });

  rl.once('line', (gameId) => {
    handleGameConnection(gameId.trim(), socket);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

server.listen(1337, () => {
  console.log('Engine listening on port 1337');
});

function getInitialGameState(scoreP1: number, scoreP2: number): GameState {
  return {
    ball: {
      x: 0.5,
      y: 0.5,
      vx: 0.00025,
      vy: 0.0002,
      radius: 0.007
    },
    paddles: {
      player1: { x: 0.05, y: 0.4, width: 0.01, height: 0.2 },
      player2: { x: 0.93, y: 0.4, width: 0.01, height: 0.2 },
    },
    scores: { player1: scoreP1, player2: scoreP2 },
    gameStatus: 'waiting',
  };
}

// Update the paddle movement logic
function updatePaddles(state: GameState, inputs: InputStates, deltaTimeMs: number) {
  const speed = 0.0015 * deltaTimeMs;
  const now = Date.now();

  // Player 1 movement
  if (inputs.player1.up && !inputs.player1.down) {
    state.paddles.player1.y = Math.max(0, state.paddles.player1.y - speed);
  }
  if (inputs.player1.down && !inputs.player1.up) {
    state.paddles.player1.y = Math.min(1 - state.paddles.player1.height, state.paddles.player1.y + speed);
  }

  // Player 2 movement - added input timeout check
  const player2InputFresh = (now - inputs.player2.lastUpdate) < 100; // 100ms timeout
  if (player2InputFresh) {
    if (inputs.player2.up && !inputs.player2.down) {
      state.paddles.player2.y = Math.max(0, state.paddles.player2.y - speed);
    }
    if (inputs.player2.down && !inputs.player2.up) {
      state.paddles.player2.y = Math.min(1 - state.paddles.player2.height, state.paddles.player2.y + speed);
    }
  } else {
    // Reset inputs if they're too old
    inputs.player2.up = false;
    inputs.player2.down = false;
  }
}

function updateBall(state: GameState, deltaTimeMs: number) {
  if (state.gameStatus !== 'playing') return;

  const ball = state.ball;

  // Apply velocity to position
  ball.x += ball.vx * deltaTimeMs;
  ball.y += ball.vy * deltaTimeMs;

  // Bounce off top and bottom walls with proper boundary checking
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius; // Ensure ball doesn't get stuck in wall
    ball.vy = Math.abs(ball.vy); // Bounce down
    preventFlatAngles(ball);
  } else if (ball.y + ball.radius >= 1) {
    ball.y = 1 - ball.radius; // Ensure ball doesn't get stuck in wall
    ball.vy = -Math.abs(ball.vy); // Bounce up
    preventFlatAngles(ball);
  }

  handlePaddleCollision(state);
  checkOutOfBoundsAndScore(state);
}

function handlePaddleCollision(state: GameState) {
  const { ball, paddles } = state;
  const epsilon = 0.001;
  const addedVelocity = 0.0015;

  // Don't process paddle collisions if ball is already off-screen
  if (ball.x < 0 || ball.x > 1) return;

  // Left paddle collision
  if (
    ball.x - ball.radius <= paddles.player1.x + paddles.player1.width &&
    ball.x + ball.radius >= paddles.player1.x &&
    ball.y + ball.radius >= paddles.player1.y &&
    ball.y - ball.radius <= paddles.player1.y + paddles.player1.height
  ) {
    // Calculate relative impact point (-0.5 to 0.5 from center)
    const hitPos = (ball.y - (paddles.player1.y + paddles.player1.height / 2)) / paddles.player1.height;
    
    ball.vx = Math.abs(ball.vx); // Ensure ball moves right
    ball.vy += hitPos * addedVelocity; // Add some vertical velocity based on hit position
    
    ball.x = paddles.player1.x + paddles.player1.width + ball.radius + epsilon;
    adjustBallSpeed(ball);
  }

  // Right paddle collision
  if (
    ball.x + ball.radius >= paddles.player2.x &&
    ball.x - ball.radius <= paddles.player2.x + paddles.player2.width &&
    ball.y + ball.radius >= paddles.player2.y &&
    ball.y - ball.radius <= paddles.player2.y + paddles.player2.height
  ) {
    // Calculate relative impact point (-0.5 to 0.5 from center)
    const hitPos = (ball.y - (paddles.player2.y + paddles.player2.height / 2)) / paddles.player2.height;
    
    ball.vx = -Math.abs(ball.vx); // Ensure ball moves left
    ball.vy += hitPos * addedVelocity; // Add some vertical velocity based on hit position
    
    ball.x = paddles.player2.x - ball.radius - epsilon;
    adjustBallSpeed(ball);
  }
}

function checkOutOfBoundsAndScore(state: GameState) {
  const ball = state.ball;

  if (ball.x < 0) {
    // Player 2 scores
    state.scores.player2 += 1;
    resetBall(state, -1); // ball moves towards scoring player
    state.gameStatus = 'waiting'; // pause until next spacebar press
  } else if (ball.x > 1) {
    // Player 1 scores
    state.scores.player1 += 1;
    resetBall(state, 1);
    state.gameStatus = 'waiting';
  }
}

function resetBall(state: GameState, direction: 1 | -1) {
  const baseSpeed = 0.00025; // Slower initial speed
  const angle = (Math.random() * (Math.PI / 3)) - (Math.PI / 6); // ±30 degrees

  state.ball = {
    x: 0.5,
    y: 0.5,
    radius: 0.015,
    vx: baseSpeed * Math.cos(angle) * direction,
    vy: baseSpeed * Math.sin(angle),
  };

  preventFlatAngles(state.ball);

  console.log('ball after reset', state.ball);
}


export function adjustBallSpeed(ball: BallState) {
  const SPEED_INCREASE = 1.02;
  const MAX_SPEED = 0.03;

  // Increase speed
  ball.vx *= SPEED_INCREASE;
  ball.vy *= SPEED_INCREASE;

  // Clamp max speed
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  preventFlatAngles(ball);

  console.log('adjusted ball speed to ', ball.vx, ball.vy);
}


function preventFlatAngles(ball: BallState) {
  const minAngle = 15 * (Math.PI / 180); // 15 degrees in radians
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const angle = Math.atan2(ball.vy, ball.vx);
  // clamp angle away from horizontal near 0 or PI
  if (Math.abs(angle) < minAngle) {
    const newAngle = angle < 0 ? -minAngle : minAngle;
    ball.vx = speed * Math.cos(newAngle);
    ball.vy = speed * Math.sin(newAngle);
  } else if (Math.abs(Math.abs(angle) - Math.PI) < minAngle) {
    // near 180 degrees (going left)
    const newAngle = angle < 0 ? -(Math.PI - minAngle) : (Math.PI - minAngle);
    ball.vx = speed * Math.cos(newAngle);
    ball.vy = speed * Math.sin(newAngle);
  }
}


function updateInputState(
  inputs: InputStates, 
  player: 'player1' | 'player2', 
  direction: 'up' | 'down', 
  state: 'release' | 'press'
) {
  if (direction === 'up') {
    inputs[player].up = state === 'press';
  } else {
    inputs[player].down = state === 'press';
  }
  inputs[player].lastUpdate = Date.now();
}

function isValidInput(input: string): input is 'up' | 'down' {
  return input === 'up' || input === 'down';
}

function isValidState(state: string): state is 'press' | 'release' {
  return state === 'press' || state === 'release';
}

function pausePressed(event: GameEvent, state: GameState, gameId: string) {
      if (event.role && event.player)
        state.gameStatus = 'paused';
      else
        state.gameStatus = 'queued';
      console.log(`[${gameId}] ${event.role} ${event.player} -> pressed pause)`);
}
