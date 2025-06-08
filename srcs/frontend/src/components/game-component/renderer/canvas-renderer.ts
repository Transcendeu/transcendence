import { GameRenderer, BallState, PaddleState } from './interfaces';
import { GameColors } from '../constants/colors';

export class CanvasRenderer implements GameRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  private pulsePhase = 0; // Track animation phase
  private lastFrameTime = 0; // For delta time calculation
  private pulseSpeed = 0.001; // Adjust speed here

  constructor(private container: HTMLElement) {}

  async setup() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.id = 'game-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.border = GameColors.canvasBorder;
    this.canvas.style.boxShadow = GameColors.canvasShadow;

    const wrapper = this.container.querySelector('.canvas-wrapper');
    if (wrapper) wrapper.appendChild(this.canvas);

    this.resize();

    this.resizeObserver?.observe(wrapper!);
    this.resizeObserver = new ResizeObserver(() => this.resize());
}

  drawGameState(paddles: PaddleState, ball: BallState, gameStatus: string) {
    if (!this.ctx || !this.canvas) return;

    const now = performance.now();
    const deltaTime = this.lastFrameTime ? now - this.lastFrameTime : 16; // Default to 60fps
    this.lastFrameTime = now;
    this.pulsePhase = (this.pulsePhase + this.pulseSpeed * deltaTime) % (Math.PI * 2);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.setBackground();

    const pulseIntensity = (Math.sin(this.pulsePhase) + 1) / 2;
    const minGlow = 5;
    const maxGlow = 25;
    const glowSpan = minGlow + pulseIntensity * (maxGlow - minGlow);
/*
    const hue = 180 + pulseIntensity * 60; // Between cyan (180) and magenta (240)
    this.ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
*/  this.ctx.strokeStyle = GameColors.centerLine;
    this.ctx.setLineDash([5, 15]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.shadowColor = GameColors.glow;
    this.ctx.shadowBlur = glowSpan;

    // Draw paddles
    const paddleEntries = Object.entries(paddles);
    paddleEntries.forEach(([_, paddle], index) => {
      const colorIndex = index % GameColors.paddleColors.length;
      this.ctx!.fillStyle = GameColors.paddleColors[colorIndex];
      this.ctx!.fillRect(
        paddle.x * this.canvas!.width,
        paddle.y * this.canvas!.height,
        paddle.width * this.canvas!.width,
        paddle.height * this.canvas!.height
      );
    });
    // Draw ball
    if (gameStatus !== 'queued') {
      this.ctx.fillStyle = GameColors.ball;
      this.ctx.beginPath();
      this.ctx.arc(
        ball.x * this.canvas.width,
        ball.y * this.canvas.height,
        ball.radius * this.canvas.width,
        0,
        2 * Math.PI
      );
      this.ctx.fill();
    }

    this.ctx.shadowBlur = 3;
    // Game status messages
    if (gameStatus === 'waiting' || gameStatus === 'queued') {
      const isWaiting = gameStatus === 'waiting';
      const mainMessage = isWaiting ? 'Press SPACE to resume' : 'Waiting for other players';

      this.ctx.font = `${Math.floor(this.canvas.height * 0.07)}px ${GameColors.text.font}`;
      this.ctx.fillStyle = isWaiting ? GameColors.text.primary : GameColors.text.secondary;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      this.ctx.fillText(mainMessage, this.canvas.width / 2, this.canvas.height * 0.91);

      // Match control hints
      const instructions = ['Move paddle with W S','⬆️ ⬇️ for local match'];
      this.ctx.font = `${Math.floor(this.canvas.height * 0.04)}px ${GameColors.text.font}`;
      this.ctx.fillStyle = GameColors.text.primary;

      instructions.forEach((line, index) => {
        this.ctx!.fillText(
          line,
          this.canvas!.width / 2,
          this.canvas!.height * (0.15 + index * 0.05)
        );
      });
    }
    this.ctx.shadowBlur = 0;
  }

  setBackground() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = GameColors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  showLoading(): void {
    // TODO
  }

  hideLoading(): void {
    // TODO
  }

  showGameControls(): void {
    (document.getElementById('matchControl') as HTMLButtonElement)?.classList.remove('hidden');
    (document.getElementById('forfeit') as HTMLButtonElement)?.classList.remove('hidden');
  }

  resize() {
    if (!this.canvas) return;

    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }


  cleanup() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

}
