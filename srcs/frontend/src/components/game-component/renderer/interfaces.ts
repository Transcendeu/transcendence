export interface BallState {
  x: number;
  y: number;
  radius: number;
}

export interface PaddleState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameRenderer {
  setup(): Promise<void>;
  drawGameState(paddles: PaddleState, ball: BallState, gameStatus: string): void;
  setBackground(): void;
  showGameControls(): void;
  resize(): void;
  cleanup(): void;
  showLoading(): void;
  hideLoading(): void;
}
