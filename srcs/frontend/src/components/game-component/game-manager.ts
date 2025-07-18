import { CanvasRenderer } from './renderer/canvas-renderer';
import { BabylonRenderer } from './renderer/babylon-renderer';
import { GameRenderer, PaddleState, BallState, MatchResult } from './renderer/interfaces';
import { createGameSession, checkPlayerMatch } from './relay-api';
import { KeyBindings } from './constants/keys';

export class GameManager {
  private currentRenderer: GameRenderer | null = null;
  private alternateRender = false;
  private activeSocket: WebSocket | null = null;
  private inputHandlerCleanup: (() => void) | null = null;
  private player1DisplayName: string | undefined;
  private player2DisplayName: string | undefined;
  private hideGui: boolean;
  private gameState: {
    player1: '';
    player2: '';
    paddles: PaddleState;
    ball: BallState;
    status: string;
  } | null = null;

  private wrapper: HTMLDivElement;
  private gameEndScreen: HTMLDivElement | null = null;
  
  constructor(
      private rootContainer: HTMLElement,
      private onGameEnd?: (result?: MatchResult) => void) {
      this.wrapper = this.createGameContainer();
      this.rootContainer.replaceChildren(this.wrapper);
      this.hideGui = false;
    }

  async initLocal(name: string, player1DisplayName?: string, player2DisplayName?: string) {
    this.hideGui = true;
    if (!name) {
      this.player1DisplayName = player1DisplayName;
      this.player2DisplayName = player2DisplayName;
      await this.setupGame(null, null, 'player1', true);
    } else {
      try {
        const matchInfo = await checkPlayerMatch(name);

        if (!matchInfo) {
          await this.setupGame(name, null, 'player1', true);
        } else if (matchInfo?.gameId && matchInfo.local) {
          await this.setupGame(name, matchInfo.gameId, 'player1', true);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return;
        }
      }
    }
}

async initOnline(name: string, matchInfo: {gameId: string | null, role: string}) {
  this.hideGui = matchInfo.role === 'spectator' ? true : false;
  await this.setupGame(name, matchInfo.gameId, matchInfo.role, false);
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
    if (this.currentRenderer) {
      this.currentRenderer.cleanup();
      this.currentRenderer = null;
    }
    this.currentRenderer = this.alternateRender ? new BabylonRenderer(this.wrapper) : new CanvasRenderer(this.wrapper);
    await this.currentRenderer.setup();
    this.currentRenderer.setBackground();
    this.currentRenderer.showGameControls();
  }

  public cleanup() {
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.removeEventListener('click', this.handleBackButtonClick);
    }
    window.removeEventListener('beforeunload', this.handleWindowBeforeUnload);

    if (this.currentRenderer) {
      this.currentRenderer.cleanup();
      this.currentRenderer = null;
    }
    if (this.activeSocket) {
        this.activeSocket.onopen = null;
        this.activeSocket.onmessage = null;
        this.activeSocket.onclose = null;
        this.activeSocket.close();
        this.activeSocket = null;
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.remove();
    }
    if (this.gameEndScreen) {
      this.gameEndScreen.remove();
      this.gameEndScreen = null;
    }
    if (this.inputHandlerCleanup) {
      this.inputHandlerCleanup();
      this.inputHandlerCleanup = null;
    }
    this.gameState = null;
    this.player1DisplayName = undefined;
    this.player2DisplayName = undefined;
  }

  async setupGame(playerName: string | null, gameId: string | null, role: string, localPlay: boolean) {
      if (!this.currentRenderer) {
        this.currentRenderer = this.alternateRender ? new BabylonRenderer(this.wrapper) : new CanvasRenderer(this.wrapper);
        await this.currentRenderer.setup();
      }

      if (!gameId) {
        gameId = await createGameSession(playerName, localPlay);
      }

      this.gameState = null;
      let normalGameEnd = false;
      this.setupBackButton();
      if (this.activeSocket) {
        this.activeSocket.close();
      }

      this.activeSocket = new WebSocket(`wss://${location.host}/ws/${gameId}`);

      this.activeSocket.onopen = () => {
        console.log('WebSocket connected');
        this.activeSocket?.send(JSON.stringify({ type: 'join', name: playerName, role }));
        this.currentRenderer?.setBackground();
        this.currentRenderer?.showGameControls();
        this.inputHandlerCleanup = this.setupInputHandlers(this.activeSocket!, localPlay);
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
        } else if (data.type === 'game_end') {
          normalGameEnd = true;
          this.showGameEndScreen(data.winner, data.scores, data.gameStatus === 'forfeited');
        }
      };

      this.activeSocket.onclose = () => {
        console.log('WebSocket closed');
        if (!normalGameEnd) {
          this.cleanup();
          this.onGameEnd?.();
        }
      };

      this.activeSocket.onerror = (err) => console.error('WebSocket error', err);

      const toggleBtn = document.getElementById('toggleRenderer') as HTMLButtonElement;
      if (toggleBtn) {
          toggleBtn.textContent = this.alternateRender ? '2D' : '3D';

          toggleBtn.onclick = async () => {
          await this.toggleRenderer();
          toggleBtn.textContent = this.alternateRender ? '2D' : '3D';
        };
      }

      const forfeitButton = document.getElementById('forfeit') as HTMLButtonElement;
      if (forfeitButton) {
        let forfeitTimeout: number | null = null;
        let isConfirming = false;
        let cooldown = false;

        const resetForfeitButton = () => {
          isConfirming = false;
          forfeitButton.textContent = 'Concede';
          forfeitButton.classList.remove('conceding');
          if (forfeitTimeout) {
            clearTimeout(forfeitTimeout);
            forfeitTimeout = null;
          }
        };

        const startCooldown = () => {
          cooldown = true;
          forfeitButton.disabled = true;
          setTimeout(() => {
            cooldown = false;
            forfeitButton.disabled = false;
          }, 1000);
        };

        forfeitButton.addEventListener('click', () => {
          if (cooldown) return;
          startCooldown();

          if (isConfirming) {
            this.activeSocket?.send(JSON.stringify({ type: 'forfeit', name: playerName, role }));
            resetForfeitButton();
          } else {
            isConfirming = true;
            forfeitButton.textContent = 'Forfeit the match?';
            forfeitButton.classList.add('conceding');
            forfeitTimeout = window.setTimeout(resetForfeitButton, 5000);
          }
        });
      }

      const matchControl = document.getElementById('matchControl') as HTMLButtonElement;
      if (matchControl) {
        matchControl.onclick = () => {
          if (!this.gameState) return;
          let type: string;
          switch (this.gameState.status) {
            case 'waiting':
              type = 'ready';
              break;
            case 'playing':
              type = 'pause';
              break;
            case 'paused':
              type = 'resume';
              break;
            default:
              return;
          }
          this.activeSocket?.send(JSON.stringify({ type: type, name: playerName, role }));
        };
      }
    }

  private updateGame(data: any) {
    if (!data) return;

    const scoreP1 = document.getElementById('score-player1');
    const scoreP2 = document.getElementById('score-player2');
    if (scoreP1 && scoreP2 && data.scores) {
      scoreP1.textContent = data.scores.player1?.toString() || '0';
      scoreP2.textContent = data.scores.player2?.toString() || '0';
    }

    const nameP1 = document.getElementById('name-player1');
    const nameP2 = document.getElementById('name-player2');
    if (nameP1 && nameP2 && data.playerNames) {
      const displayp1 = this.player1DisplayName || data.playerNames.player1;
      const displayp2 = this.player2DisplayName || data.playerNames.player2;
      nameP1.textContent = displayp1 || 'Waiting...';
      nameP2.textContent = displayp2 || 'Waiting...';
    }

    const matchControl = document.getElementById('matchControl') as HTMLButtonElement;
    if (matchControl && data.gameStatus) {
      switch (data.gameStatus) {
        case 'waiting':
          matchControl.textContent = 'Waiting';
          matchControl.disabled = true;
          break;
        case 'playing':
          matchControl.textContent = 'Pause';
          matchControl.disabled = false;
          break;
        case 'paused':
          matchControl.textContent = 'Resume';
          matchControl.disabled = false;
          break;
        case 'queued':
          matchControl.textContent = 'Waiting';
          matchControl.disabled = true;
          break;
        default:
          matchControl.disabled = true;
      }
      if (matchControl.disabled) {
          matchControl.classList.remove('btn-start');
      } else {
          matchControl.classList.add('btn-start');
          matchControl.classList.remove('hidden');
      }
    }

    const forfeitButton = document.getElementById('forfeit') as HTMLButtonElement;
    if (forfeitButton) {
      if (this.hideGui) {
        forfeitButton.disabled = true;
        forfeitButton.classList.add('hidden');
      } else {
        forfeitButton.disabled = false;
        forfeitButton.classList.remove('hidden');
      }
    }
  }

    private setupInputHandlers(socket: WebSocket, localPlay: boolean) {
    const keyState = {
      player1: { up: false, down: false },
      player2: { up: false, down: false },
      lastSent: 0
    };

    const sendInput = (() => {
      const lastSendTime: Record<'player1' | 'player2', number> = {
        player1: 0,
        player2: 0
      };

      return (role: 'player1' | 'player2', key: 'up' | 'down', state: 'press' | 'release') => {
        const now = Date.now();
        if (state === 'release' || now - lastSendTime[role] >= 50) {
          socket.send(JSON.stringify({
            type: 'input',
            input: key,
            state,
            role
          }));
          lastSendTime[role] = now;
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

      const norm = this.normalizeKey(e.key, localPlay);
      if (!norm) return;   
      const { key, role } = norm;
      if (localPlay && (e.key === KeyBindings.player2.up || e.key === KeyBindings.player2.down)) {
        e.preventDefault();
      }
      if ((keyState as any)[role][key] !== isKeyDown) {
        (keyState as any)[role][key] = isKeyDown;
        if (role === 'player1' || role === 'player2' ) {
          if (key === 'up' || key === 'down') {
            sendInput(role, key, isKeyDown ? 'press' : 'release');
          }
        }
      }
    };

    const movementInterval = setInterval(() => {
      const now = Date.now();
      if (now - keyState.lastSent < 50) return; // Throttle to 50ms
      keyState.lastSent = now;
      for (const role of ['player1', 'player2'] as const) {
        for (const key of ['up', 'down'] as const) {
          if (keyState[role][key]) {
            sendInput(role, key, 'press');
          }
        }
      }
    }, 16); // ~60fps

    const handleKeyDown = (e: KeyboardEvent) => onKeyChange(e, true);
    const handleKeyUp = (e: KeyboardEvent) => onKeyChange(e, false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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

  private showGameEndScreen(winner: 'player1' | 'player2', scores: { player1: number, player2: number }, concession: boolean) {
    // Hide game elements
    this.wrapper.querySelector('.canvas-wrapper')?.classList.add('hidden');
    this.wrapper.querySelector('.controls')?.classList.add('hidden');

    // Create or update end screen
    if (!this.gameEndScreen) {
      this.gameEndScreen = document.createElement('div');
      this.gameEndScreen.className = 'game-end-screen absolute inset-0 z-50 bg-black/80 flex items-center justify-center';
      this.wrapper.appendChild(this.gameEndScreen);
    }

    const winnerName = winner === 'player1' 
      ? this.player1DisplayName || this.gameState?.player1
      : this.player2DisplayName || this.gameState?.player2;

    const loserName = winner === 'player1'
      ? this.player2DisplayName || this.gameState?.player2
      : this.player1DisplayName || this.gameState?.player1;

    let result;
    if (concession) {
      result = 'by forfeit!';
    } else {
      result = `${scores.player1}-${scores.player2}`;
    }
    
this.gameEndScreen.innerHTML = `
  <div class="flex items-center justify-center gap-10 p-8 w-full max-w-6xl">
    
    <!-- Winner Image with Name -->
    <div class="relative flex-1 flex justify-center items-center">
      <img src="/assets/winner.png" alt="Winner" class="max-h-80 object-contain drop-shadow-neonCyan" />
      <div class="absolute top-4 text-white text-xl font-bold bg-black/60 px-4 py-1 rounded">
        ${winnerName}
      </div>
    </div>

    <!-- Center Content -->
    <div class="end-screen-content flex flex-col items-center justify-center gap-6 text-center px-6 py-8 bg-black/60 rounded-2xl shadow-lg w-[30rem]">
      <h2 class="end-title text-5xl font-bold tracking-wide">VICTORY</h2>
      <div class="winner-glow text-3xl font-bold text-neonCyan">
        ${winnerName} wins<br><span class="text-neonMagenta">${result}</span>
      </div>
      <button id="continueBtn" class="continue-btn px-10 py-3 font-bold mt-4">Continue</button>
    </div>

    <!-- Loser Image with Name -->
    <div class="relative flex-1 flex justify-center items-center">
      <img src="/assets/loser.png" alt="Loser" class="max-h-80 object-contain drop-shadow" />
      <div class="absolute top-4 text-white text-xl font-bold bg-black/60 px-4 py-1 rounded">
        ${loserName}
      </div>
    </div>
    
  </div>
`;

    const continueBtn = this.gameEndScreen.querySelector('#continueBtn') as HTMLButtonElement;
    continueBtn.onclick = () => {
      this.cleanup();
      this.onGameEnd?.({matchWinner: winner, finalScore: scores, forfeit: concession, playerNames: { player1: this.gameState?.player1, player2: this.gameState?.player2}});
    };
  }

  private createGameContainer(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'game-container flex flex-col min-h-screen bg-neutral-950 pt-4';

    const inner = document.createElement('div');
    inner.className = 'flex flex-col items-center gap-4 w-[64vw] p-4 bg-black text-white rounded flex-grow';
 
    inner.innerHTML = `
      <!-- HUD -->
      <div class="flex flex-col items-center gap-2 w-full">
        <div class="game-header w-full flex items-center justify-between">
          <button id="backButton" class="flex items-center gap-1 w-10 justify-start">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
          </svg>
          </button>
          <h2 class="text-center flex-1">PONG</h2>
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
      <div class="canvas-wrapper relative aspect-video w-full max-h-[65vh] p-4">
        <canvas id="game-canvas" class="absolute top-0 left-0 w-full h-full gameCanvas"></canvas>
      </div>

      <!-- Footer controls -->
      <footer class="controls w-full flex justify-between items-center px-2 py-1">
        <div class="w-[33%] flex justify-center">
          <button id="matchControl" class="btn-control btn-start">Start</button>
        </div>
        <div class="w-[33%] flex justify-center">
          <button id="toggleRenderer" class="btn-control btn-toggle">3D</button>
        </div>
        <div class="w-[33%] flex justify-center">
          <button id="forfeit" class="btn-control btn-forfeit">Concede</button>
        </div>
      </footer>
    `;

    wrapper.appendChild(inner);
    return wrapper;
  }

  private setupBackButton() {
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', this.handleBackButtonClick);
    }

    window.addEventListener('beforeunload',this.handleWindowBeforeUnload);
    window.addEventListener('popstate', this.handlePopState);
  }

  private handleBackButtonClick = (e: Event) => {
      e.preventDefault(); 
      this.leavePage();
  };

  private handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      this.leavePage();
  };

  private handleWindowBeforeUnload = (e: BeforeUnloadEvent) => {
      this.leavePage();
      e.preventDefault();
  };

  private leavePage() {    
      this.cleanup();
      this.onGameEnd?.();
  }
}
