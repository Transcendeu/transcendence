import net, { Socket } from 'net';
import { createInterface } from 'readline';

const GameConstants = {
  BALL: {
    INITIAL_BASE_SPEED: 0.0005,  // Starting speed for new games/resets
    SPEED_INCREASE_FACTOR: 1.15,   // Multiplier per collision
    MAX_SPEED: 0.003,              // Absolute maximum speed
    PRESERVATION_RATIO: 0.42,      // Speed retention between rounds
    MAX_COLLISION_BOOST: 3.0,     // Max speed multiplier from collisions
    MIN_ANGLE: 15 * (Math.PI / 180),
    PADDLE_REBOUND_FACTOR: 0.0005,
    RADIUS: 0.008
  },
  
  PADDLE: {
    SPEED: 0.0015,
    WIDTH: 0.011,
    HEIGHT: 0.2,
    PLAYER1_X: 0.05,
    PLAYER2_X: 0.94,
    DEFAULT_Y: 0.4
  },

  RULES: {
    DEFAULT_MAX_SCORE: 11,
    INPUT_TIMEOUT_MS: 100  // How long inputs stay active without updates
  },
  
  LOOP: {
    FPS: 60,
    MAX_FRAME_TIME_MS: 16  // Clamp delta time to ~60fps
  }
};

interface PaddleState {
  x: number;       // normalized 0..1 horizontal position
  y: number;       // normalized 0..1 vertical position (top)
  width: number;   // normalized width
  height: number;  // normalized height
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  collisionCount: number;  // Add this to track collisions
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
  gameStatus?: 'waiting' | 'playing' | 'paused' | 'queued' | 'forfeited' | 'finished';
  maxScore: number;
  winner?: 'player1' | 'player2';
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
      if (game?.state.gameStatus === 'finished' || game?.state.gameStatus === 'forfeited') {
        finishGame(game);
        return;
      }
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

    try {
      const event: GameEvent = JSON.parse(line);
      switch (event.type) {
          case 'input': {
              if (event.role === 'player1' || event.role === 'player2') {
                if (event.input === 'space') {
                  game.state.gameStatus = 'playing';
                } else if (game.state.gameStatus === 'playing' && isValidInput(event.input) && isValidState(event.state)) {
                  updateInputState(game.inputs, event.role, event.input, event.state);
                }
              }
            }
            break;
          case 'ready':
            game.state.gameStatus = 'waiting';
            console.log(`[${gameId}] ${event.role} ${event.player} -> pressed ready)`);
            break;
          case 'pause':
            pausePressed(event, game.state, gameId);
            break;
          case 'resume':
            resumePressed(event, game.state, gameId);
            break;
          case 'forfeit':
            playerConceded(event, game.state,gameId);
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

function getInitialGameState(scoreP1: number, scoreP2: number, maxScore?: number): GameState {
  if (!maxScore) {
    maxScore = 11;
  }
  return {
    ball: {
      x: 0.5,
      y: 0.5,
      vx: GameConstants.BALL.INITIAL_BASE_SPEED,
      vy: GameConstants.BALL.INITIAL_BASE_SPEED * 0.08,
      radius: GameConstants.BALL.RADIUS,
      collisionCount: 0
    },
    paddles: {
      player1: { 
        x: GameConstants.PADDLE.PLAYER1_X, 
        y: GameConstants.PADDLE.DEFAULT_Y, 
        width: GameConstants.PADDLE.WIDTH, 
        height: GameConstants.PADDLE.HEIGHT 
      },
      player2: { 
        x: GameConstants.PADDLE.PLAYER2_X, 
        y: GameConstants.PADDLE.DEFAULT_Y, 
        width: GameConstants.PADDLE.WIDTH, 
        height: GameConstants.PADDLE.HEIGHT 
      },
    },
    scores: { player1: scoreP1, player2: scoreP2 },
    gameStatus: 'waiting',
    maxScore: maxScore % 2 === 0 ? maxScore + 1 : maxScore, // Ensure odd number
    winner: undefined
  };
}

function updatePaddles(state: GameState, inputs: InputStates, deltaTimeMs: number) {
  const speed = GameConstants.PADDLE.SPEED * deltaTimeMs;
  const now = Date.now();
  const inputTimeout = GameConstants.RULES.INPUT_TIMEOUT_MS;

  // Player 1 movement
  const player1InputFresh = (now - inputs.player1.lastUpdate) < inputTimeout;
  if (player1InputFresh) {
    if (inputs.player1.up && !inputs.player1.down) {
      state.paddles.player1.y = Math.max(0, state.paddles.player1.y - speed);
    }
    if (inputs.player1.down && !inputs.player1.up) {
      state.paddles.player1.y = Math.min(1 - state.paddles.player1.height, state.paddles.player1.y + speed);
    }
  } else {
    inputs.player1.up = false;
    inputs.player1.down = false;
  }

  // Player 2 movement
  const player2InputFresh = (now - inputs.player2.lastUpdate) < inputTimeout;
  if (player2InputFresh) {
    if (inputs.player2.up && !inputs.player2.down) {
      state.paddles.player2.y = Math.max(0, state.paddles.player2.y - speed);
    }
    if (inputs.player2.down && !inputs.player2.up) {
      state.paddles.player2.y = Math.min(1 - state.paddles.player2.height, state.paddles.player2.y + speed);
    }
  } else {
    inputs.player2.up = false;
    inputs.player2.down = false;
  }
}

function updateBall(state: GameState, deltaTimeMs: number) {
  deltaTimeMs = Math.min(deltaTimeMs, GameConstants.LOOP.MAX_FRAME_TIME_MS);
  if (state.gameStatus !== 'playing') return;

  const ball = state.ball;
  ball.x += ball.vx * deltaTimeMs;
  ball.y += ball.vy * deltaTimeMs;

  // Wall collisions
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
    preventFlatAngles(ball);
  } else if (ball.y + ball.radius >= 1) {
    ball.y = 1 - ball.radius;
    ball.vy = -Math.abs(ball.vy);
    preventFlatAngles(ball);
  }

  handlePaddleCollision(state);
  checkOutOfBoundsAndScore(state);
}

function handlePaddleCollision(state: GameState) {
  const { ball, paddles } = state;
  const epsilon = 0.001;

  if (ball.x < 0 || ball.x > 1) return;

  const handleCollision = (paddle: PaddleState, direction: number) => {
    const hitPos = (ball.y - (paddle.y + paddle.height / 2)) / paddle.height;
    ball.vx = Math.abs(ball.vx) * direction;
    ball.vy += hitPos * GameConstants.BALL.PADDLE_REBOUND_FACTOR;
    ball.x = paddle.x + (direction > 0 ? paddle.width + ball.radius : -ball.radius) + (epsilon * direction);
    adjustBallSpeed(ball);
  };

  // Left paddle collision
  if (
    ball.x - ball.radius <= paddles.player1.x + paddles.player1.width &&
    ball.x + ball.radius >= paddles.player1.x &&
    ball.y + ball.radius >= paddles.player1.y &&
    ball.y - ball.radius <= paddles.player1.y + paddles.player1.height
  ) {
    handleCollision(paddles.player1, 1);
  }

  // Right paddle collision
  if (
    ball.x + ball.radius >= paddles.player2.x &&
    ball.x - ball.radius <= paddles.player2.x + paddles.player2.width &&
    ball.y + ball.radius >= paddles.player2.y &&
    ball.y - ball.radius <= paddles.player2.y + paddles.player2.height
  ) {
    handleCollision(paddles.player2, -1);
  }
}

function checkOutOfBoundsAndScore(state: GameState) {
  const ball = state.ball;

  if (ball.x < 0) {
    // Player 2 scores
    state.scores.player2 += 1;
    resetBall(state, -1); // ball moves towards scoring player
    state.gameStatus = 'waiting'; // pause until next spacebar press
    checkGameEnd(state, 'player2');
  } else if (ball.x > 1) {
    // Player 1 scores
    state.scores.player1 += 1;
    resetBall(state, 1);
    state.gameStatus = 'waiting';
    checkGameEnd(state, 'player1');
  }
}

function checkGameEnd(state: GameState, scoringPlayer: 'player1' | 'player2') {
  const otherPlayer = scoringPlayer === 'player1' ? 'player2' : 'player1';
  if (state.scores[scoringPlayer] >= state.maxScore) {
    state.gameStatus = 'finished';
    state.winner = scoringPlayer;
    return;
  }

  const pointsAhead = state.scores[scoringPlayer] - state.scores[otherPlayer];
  const pointsRemaining = state.maxScore - state.scores[scoringPlayer];

  if (pointsAhead > pointsRemaining) {
    state.gameStatus = 'finished';
    state.winner = scoringPlayer;
  }
}

function resetBall(state: GameState, direction: 1 | -1) {
  const preservedCollisions = Math.floor(state.ball.collisionCount * GameConstants.BALL.PRESERVATION_RATIO);
  const angle = (Math.random() * (Math.PI / 3)) - (Math.PI / 6);
  const speedMultiplier = Math.min(
    Math.pow(GameConstants.BALL.SPEED_INCREASE_FACTOR, preservedCollisions),
    GameConstants.BALL.MAX_COLLISION_BOOST
  );
  const speed = GameConstants.BALL.INITIAL_BASE_SPEED * 
  Math.min(
    Math.pow(GameConstants.BALL.SPEED_INCREASE_FACTOR, preservedCollisions),
    GameConstants.BALL.MAX_COLLISION_BOOST
  );

  state.ball = {
    x: 0.5,
    y: 0.5,
    radius: GameConstants.BALL.RADIUS,
    vx: speed * Math.cos(angle) * direction,
    vy: speed * Math.sin(angle),
    collisionCount: preservedCollisions
  };

  preventFlatAngles(state.ball);
}

function adjustBallSpeed(ball: BallState) {
  ball.collisionCount++;
  const currentSpeed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const direction = Math.atan2(ball.vy, ball.vx);
  const newSpeed = Math.min(
    GameConstants.BALL.INITIAL_BASE_SPEED * 
      Math.pow(GameConstants.BALL.SPEED_INCREASE_FACTOR, ball.collisionCount),
    GameConstants.BALL.MAX_SPEED
  );
  if (newSpeed > currentSpeed) {
    ball.vx = newSpeed * Math.cos(direction);
    ball.vy = newSpeed * Math.sin(direction);
  }
  preventFlatAngles(ball);
}

function preventFlatAngles(ball: BallState) {
  const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  const angle = Math.atan2(ball.vy, ball.vx);
  
  if (Math.abs(angle) < GameConstants.BALL.MIN_ANGLE) {
    const newAngle = angle < 0 ? -GameConstants.BALL.MIN_ANGLE : GameConstants.BALL.MIN_ANGLE;
    ball.vx = speed * Math.cos(newAngle);
    ball.vy = speed * Math.sin(newAngle);
  } else if (Math.abs(Math.abs(angle) - Math.PI) < GameConstants.BALL.MIN_ANGLE) {
    const newAngle = angle < 0 ? -(Math.PI - GameConstants.BALL.MIN_ANGLE) : (Math.PI - GameConstants.BALL.MIN_ANGLE);
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
  if (event.role) {
    state.gameStatus = 'paused';
    // Reset inputs when pausing
    const game = games.get(gameId);
    if (game) {
      game.inputs.player1.up = false;
      game.inputs.player1.down = false;
      game.inputs.player2.up = false;
      game.inputs.player2.down = false;
    }
  } else {
    state.gameStatus = 'queued';
  }
  console.log(`[${gameId}] ${event.role} ${event.player} -> pressed pause)`);
}

function resumePressed(event: GameEvent, state: GameState, gameId: string) {
  if (state.gameStatus !== 'paused' ) {
    console.warn("Invalid resume sent from ", event.player, " with role ", event.role);
    return;
  }
  if (event.role) {
    state.gameStatus = 'playing';
    const game = games.get(gameId);
    if (game) {
      game.inputs.player1.up = false;
      game.inputs.player1.down = false;
      game.inputs.player2.up = false;
      game.inputs.player2.down = false;
    }
  }
}

function playerConceded(event: GameEvent, state: GameState, gameId: string) {
    if (event.role === 'player1' || event.role === 'player2') {
    const winner = event.role === 'player1' ? 'player2' : 'player1';
    state.gameStatus = 'forfeited';
    state.winner = winner;
    console.log(`[${gameId}] ${event.role} ${event.player} -> pressed forfeit)`);
  } else {
    console.warn(`Invalid forfeit command received on engine by ${event.player} with role ${event.role}`);
  }
}

function finishGame(game: { 
  state: GameState; 
  clients: Set<Socket>;
  interval?: NodeJS.Timeout; }) {
  // Send final game state
  const payload = {
    type: 'game_end',
    winner: game.state.winner,
    scores: game.state.scores,
    gameStatus: game.state.gameStatus // 'finished' or 'forfeited'
  };

  const json = JSON.stringify(payload) + '\n';
  for (const client of game.clients) {
    client.write(json);
  }

  // Clear interval but keep socket connections open
  clearInterval(game.interval!);
  
  // Don't close the TCP sockets here - let the relay handle that
  console.log(`Game ${game.state.winner} won with score ${game.state.scores.player1}-${game.state.scores.player2}`);
}
