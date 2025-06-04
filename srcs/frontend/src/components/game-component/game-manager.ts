import { CanvasRenderer } from './renderer/canvas-renderer';
import { GameRenderer, PaddleState, BallState } from './renderer/interfaces';
import { createGameSession, checkPlayerMatch } from './relay-api';
import { KeyBindings } from './constants/keys';

export class GameManager {
  private currentRenderer: GameRenderer | null = null;
  private alternateRender = false;
  private activeSocket: WebSocket | null = null;
  private gameState: {
    player1: '';
    player2: '';
    paddles: PaddleState;
    ball: BallState;
    status: string;
  } | null = null;

  private wrapper: HTMLDivElement;

  constructor(
      private rootContainer: HTMLElement,
      private onGameEnd?: () => void) { //TODO: check/implement this
      this.wrapper = this.createGameContainer();
      this.rootContainer.replaceChildren(this.wrapper); // Or appendChild for stacking
//      this.rootContainer.appendChild(this.wrapper);
    }

  async init(name: string, isLocal: boolean) {
    try {
      const matchInfo = await checkPlayerMatch(name);

      if (!matchInfo && isLocal) {
        await this.setupGame(name, null, 'player1', isLocal);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        // Treat 404 as "no match found" and create new game
        return;
      }
    }
}
 
  async toggleRenderer() {
    if (!this.activeSocket) return;
   
    this.currentRenderer?.showLoading();
    try {
      this.alternateRender = !this.alternateRender;
      await this.swapRenderer();
      
      if (this.gameState && this.currentRenderer) {
        this.currentRenderer.drawGameState(
          this.gameState.paddles,
          this.gameState.ball,
          this.gameState.status
        );
      }
    } finally {
      this.currentRenderer?.hideLoading();
    }
  }

  private async swapRenderer() {
    // Cleanup only the renderer
    if (this.currentRenderer) {
      this.currentRenderer.cleanup();
      this.currentRenderer = null;
    }
    
    // Initialize new renderer
    this.currentRenderer = /*this.alternateRender ? new B-Renderer() :*/ new CanvasRenderer(this.wrapper);
    await this.currentRenderer.setup();
    
    // Reapply background and controls
    this.currentRenderer.setBackground();
    this.currentRenderer.showGameControls();
  }

  private cleanup() {
    if (this.currentRenderer) {
      this.currentRenderer.cleanup();
      this.currentRenderer = null;
    }
    if (this.activeSocket) {
      this.activeSocket.close();
      this.activeSocket = null;
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }

  async setupGame(
    playerName: string,
    gameId: string | null,
    role: string,
    localPlay: boolean) {
    if (!this.currentRenderer) {
      this.currentRenderer = /*this.alternateRender ? new B-Renderer() :*/ new CanvasRenderer(this.wrapper);
      await this.currentRenderer.setup();
    }

    if (!gameId) {
      gameId = await createGameSession(playerName, localPlay);
    }

    this.gameState = null;

    if (this.activeSocket) {
      this.activeSocket.close();
    }

    this.activeSocket = new WebSocket(`ws://${location.host}/ws/${gameId}`);

    this.activeSocket.onopen = () => {
      console.log('WebSocket connected');
      this.activeSocket?.send(JSON.stringify({ type: 'join', name: playerName, role }));
      this.currentRenderer?.setBackground();
      this.currentRenderer?.showGameControls();
      this.setupInputHandlers(this.activeSocket!, localPlay);
    };

    this.activeSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'state') {
        this.gameState = {
          paddles: data.paddles,
          ball: data.ball,
          status: data.gameStatus,
          player1: data.playerNames.player1,
          player2: data.playerNames.player2,
        };

        this.currentRenderer?.drawGameState(data.paddles, data.ball, this.gameState.status);
        this.updateGame(data);
      }
    };

    this.activeSocket.onclose = () => {
      console.log('WebSocket closed');
      this.cleanup(); // teardown visuals + socket
      this.onGameEnd?.(); // trigger whatever post-game logic was passed in (e.g. navigate back, resolve promise)
    };

    this.activeSocket.onerror = (err) => console.error('WebSocket error', err);

    const matchControl = document.getElementById('matchControl') as HTMLButtonElement;
    const forfeit = document.getElementById('forfeit') as HTMLButtonElement;
    let matchState: 'playing' | 'paused' = 'paused';

    matchControl.onclick = () => {
      const type = matchState === 'paused' ? 'resume' : 'pause';
      this.activeSocket?.send(JSON.stringify({ type }));
      matchControl.textContent = matchState === 'paused' ? 'Pause' : 'Resume';
      matchState = type === 'resume' ? 'playing' : 'paused';
    };

    forfeit.onclick = () => {
      this.activeSocket?.send(JSON.stringify({ type: 'forfeit' }));
    };
  }

  private updateGame(data: any) {   
      const scoreP1 = document.getElementById('score-player1');
      const scoreP2 = document.getElementById('score-player2');
      if (scoreP1 && scoreP2) {
        scoreP1.textContent = data.scores.player1.toString();
        scoreP2.textContent = data.scores.player2.toString();
      }
      const nameP1 = document.getElementById('name-player1');
      const nameP2 = document.getElementById('name-player2');
      if (nameP1 && nameP2 && data.playerNames) {
        nameP1.textContent = data.playerNames.player1 || 'Waiting...';
        nameP2.textContent = data.playerNames.player2 || 'Waiting...';
      }    
  }

  private setupInputHandlers(socket: WebSocket, localPlay: boolean) {
  // Track key states and timestamps
  const keyState = {
    player1: { up: false, down: false },
    player2: { up: false, down: false },
    lastSent: 0
  };

  // Create throttled send function
  const sendInput = (() => {
    let lastSendTime = 0;
    return (role: 'player1' | 'player2', key: 'up' | 'down', state: 'press' | 'release') => {
      const now = Date.now();
      if (state === 'release' || now - lastSendTime >= 50) {
        socket.send(JSON.stringify({
          type: 'input',
          input: key,
          state,
          role
        }));
        lastSendTime = now;
      }
    };
  })();

  
  const onKeyChange = (e: KeyboardEvent, isKeyDown: boolean) => {
    if (e.code === KeyBindings.ready) {
      if (this.gameState?.status !== 'waiting') return;
      e.preventDefault();
      if (isKeyDown && !e.repeat) {
        socket.send(JSON.stringify({
          type: 'input',
          input: 'space',
          state: 'press',
          role: 'player1'
        }));
      }
      return;
    }

    // Normalize key input
    const norm = this.normalizeKey(e.key, localPlay);
    if (!norm) return;
    
    const { key, role } = norm;

    // Prevent default for arrow keys
    if (localPlay && (e.key === KeyBindings.player2.up || e.key === KeyBindings.player2.down)) {
      e.preventDefault();
    }

    // Update state and send immediately
    if ((keyState as any)[role][key] !== isKeyDown) {
      (keyState as any)[role][key] = isKeyDown;
      if (role === 'player1' || role === 'player2' ) {
        if (key === 'up' || key === 'down') {
          sendInput(role, key, isKeyDown ? 'press' : 'release');
        }
      }
    }
  };


  // Continuous movement handler
  const movementInterval = setInterval(() => {
    const now = Date.now();
    if (now - keyState.lastSent < 50) return; // Throttle to 50ms
    
    keyState.lastSent = now;
    
    // Send continuous press for any held keys
    for (const role of ['player1', 'player2'] as const) {
      for (const key of ['up', 'down'] as const) {
        if (keyState[role][key]) {
          sendInput(role, key, 'press');
        }
      }
    }
  }, 16); // ~60fps

  // Set up event listeners
  const handleKeyDown = (e: KeyboardEvent) => onKeyChange(e, true);
  const handleKeyUp = (e: KeyboardEvent) => onKeyChange(e, false);
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Clean up when window loses focus
  const handleBlur = () => {
    for (const role of ['player1', 'player2'] as const) {
      for (const key of ['up', 'down'] as const) {
        if (keyState[role][key]) {
          keyState[role][key] = false;
          sendInput(role, key, 'release');
        }
      }
    }
  };
  window.addEventListener('blur', handleBlur);

  // Return cleanup function
  return () => {
    clearInterval(movementInterval);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
  };
}

private normalizeKey(key: string, localPlay: boolean) {
    const lower = key.toLowerCase();
    if (lower === KeyBindings.player1.up) return { key: 'up', role: 'player1' };
    if (lower === KeyBindings.player1.down) return { key: 'down', role: 'player1' };
    if (localPlay && key === KeyBindings.player2.up) return { key: 'up', role: 'player2' };
    if (localPlay && key === KeyBindings.player2.down) return { key: 'down', role: 'player2' };
    return null;
  }

  private createGameContainer(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'game-container flex flex-col min-h-screen bg-neutral-950 pt-4';


    const inner = document.createElement('div');
    inner.className = 'flex flex-col items-center gap-4 w-[64vw] p-4 bg-black text-white rounded flex-grow';

  
    inner.innerHTML = `
      <!-- HUD -->
      <div class="flex flex-col items-center gap-8 w-full">
        <div class="game-header w-full">
          <h2>PONG</h2>
        </div>

        <div class="hud flex justify-between items-center w-full text-sm sm:text-base">
          <div class="player-info score-board w-[48%]">
            <span id="name-player1">Player 1</span>
            <span id="score-player1">0</span>
          </div>
          <div class="player-info score-board text-right w-[48%]">
            <span id="score-player2">0</span>
            <span id="name-player2">Player 2</span>
          </div>
        </div>
      </div>

      <!-- Canvas -->
      <div class="canvas-wrapper gameCanvas relative aspect-video w-full max-h-[65vh] rounded-lg overflow-hidden">
        <canvas id="game-canvas" class="absolute top-0 left-0 w-full h-full"></canvas>
      </div>

      <!-- Footer controls -->
      <footer class="controls w-full flex justify-between items-center px-2 py-1">
        <div class="w-[48%] flex justify-center">
          <button id="matchControl" class="bg-black text-white text-sm px-2 py-1 shadow-[0_0_0px_#0051ff] hover:shadow-[0_0_10px_#0051ff] transition rounded-none">
            Start
          </button>
        </div>
        <div class="w-[48%] flex justify-center">
          <button id="forfeit" class="bg-black text-white text-sm px-2 py-1 shadow-[0_0_0px_#ff1500] hover:shadow-[0_0_10px_#ff1500] transition rounded-none">
            Forfeit
          </button>
        </div>
      </footer>
    `;

    wrapper.appendChild(inner);
    return wrapper;
  }

}

