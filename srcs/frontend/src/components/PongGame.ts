export class PongGame {
    private container: HTMLElement;
    private canvas!: HTMLCanvasElement;
    private context!: CanvasRenderingContext2D;
    private onGameEnd: () => void;

    // Game objects
    private paddle1!: Paddle;
    private paddle2!: Paddle;
    private ball!: Ball;
    private score!: Score;

    // Game state
    private gameLoop: number = 0;
    private gameStarted: boolean = false;

    constructor(container: HTMLElement, onGameEnd: () => void) {
        this.container = container;
        this.onGameEnd = onGameEnd;
        this.render();
        this.initializeGame();
        this.setupEventListeners();
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="game-container">
                <div class="game-header">
                    <h2>PONG</h2>
                </div>
                <canvas id="gameCanvas" width="800" height="600"></canvas>
                <div class="score-board">
                    <div>Player 1: <span id="score1">0</span></div>
                    <div>Player 2: <span id="score2">0</span></div>
                </div>
                <div class="controls-info">
                    <p>Player 1: W/S | Player 2: ↑/↓ | Press SPACE to start</p>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.context = this.canvas.getContext('2d')!;
    }

    private initializeGame(): void {
        // Initialize game objects
        const paddleWidth = 10;
        const paddleHeight = 100;
        const ballSize = 10;

        this.paddle1 = new Paddle(
            30, // x
            this.canvas.height / 2 - paddleHeight / 2, // y
            paddleWidth,
            paddleHeight,
            ['w', 'W'], // Accept both lowercase and uppercase
            ['s', 'S']  // Accept both lowercase and uppercase
        );

        this.paddle2 = new Paddle(
            this.canvas.width - 30 - paddleWidth,
            this.canvas.height / 2 - paddleHeight / 2,
            paddleWidth,
            paddleHeight,
            ['ArrowUp'],
            ['ArrowDown']
        );

        this.ball = new Ball(
            this.canvas.width / 2,
            this.canvas.height / 2,
            ballSize
        );

        this.score = new Score();
    }

    private setupEventListeners(): void {
        // Keyboard controls
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === ' ' && !this.gameStarted) {
                this.startGame();
            }
            
            this.paddle1.handleKeyDown(e.key);
            this.paddle2.handleKeyDown(e.key);
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            this.paddle1.handleKeyUp(e.key);
            this.paddle2.handleKeyUp(e.key);
        });
    }

    private startGame(): void {
        if (this.gameStarted) return;
        
        this.gameStarted = true;
        this.ball.reset();
        this.gameLoop = window.setInterval(() => this.update(), 1000 / 60);
    }

    private update(): void {
        // Clear canvas
        this.context.fillStyle = '#000';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw center line
        this.context.setLineDash([5, 15]);
        this.context.beginPath();
        this.context.moveTo(this.canvas.width / 2, 0);
        this.context.lineTo(this.canvas.width / 2, this.canvas.height);
        this.context.strokeStyle = '#0ff';
        this.context.stroke();

        // Update game objects
        this.paddle1.update(this.canvas.height);
        this.paddle2.update(this.canvas.height);
        this.ball.update();

        // Check collisions
        this.checkCollisions();

        // Draw game objects
        this.paddle1.draw(this.context);
        this.paddle2.draw(this.context);
        this.ball.draw(this.context);

        // Update score display
        document.getElementById('score1')!.textContent = this.score.player1.toString();
        document.getElementById('score2')!.textContent = this.score.player2.toString();
    }

    private checkCollisions(): void {
        // Ball with top and bottom walls
        if (this.ball.y <= 0 || this.ball.y >= this.canvas.height) {
            this.ball.reverseY();
        }

        // Ball with paddles
        if (this.ball.collidesWith(this.paddle1) || this.ball.collidesWith(this.paddle2)) {
            this.ball.reverseX();
        }

        // Ball with left and right walls (scoring)
        if (this.ball.x <= 0) {
            this.score.player2++;
            this.checkWinner();
        } else if (this.ball.x >= this.canvas.width) {
            this.score.player1++;
            this.checkWinner();
        }
    }

    private checkWinner(): void {
        if (this.score.player1 >= 11 || this.score.player2 >= 11) {
            clearInterval(this.gameLoop);
            this.onGameEnd();
        } else {
            this.ball.reset();
        }
    }
}

class Paddle {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    private speed: number = 5;
    private upKeys: string[];
    private downKeys: string[];
    private moving: number = 0; // -1 for up, 0 for still, 1 for down

    constructor(x: number, y: number, width: number, height: number, upKeys: string[], downKeys: string[]) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.upKeys = upKeys;
        this.downKeys = downKeys;
    }

    public handleKeyDown(key: string): void {
        if (this.upKeys.includes(key)) this.moving = -1;
        if (this.downKeys.includes(key)) this.moving = 1;
    }

    public handleKeyUp(key: string): void {
        if ((this.upKeys.includes(key) && this.moving === -1) ||
            (this.downKeys.includes(key) && this.moving === 1)) {
            this.moving = 0;
        }
    }

    public update(canvasHeight: number): void {
        this.y += this.moving * this.speed;
        this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));
    }

    public draw(context: CanvasRenderingContext2D): void {
        context.fillStyle = '#0ff';
        context.shadowColor = '#0ff';
        context.shadowBlur = 10;
        context.fillRect(this.x, this.y, this.width, this.height);
        context.shadowBlur = 0;
    }
}

class Ball {
    public x: number;
    public y: number;
    public size: number;
    private speedX: number = 5;
    private speedY: number = 5;
    private initialX: number;
    private initialY: number;

    constructor(x: number, y: number, size: number) {
        this.initialX = x;
        this.initialY = y;
        this.x = x;
        this.y = y;
        this.size = size;
    }

    public update(): void {
        this.x += this.speedX;
        this.y += this.speedY;
    }

    public draw(context: CanvasRenderingContext2D): void {
        context.fillStyle = '#0ff';
        context.shadowColor = '#0ff';
        context.shadowBlur = 10;
        context.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        context.shadowBlur = 0;
    }

    public reset(): void {
        this.x = this.initialX;
        this.y = this.initialY;
        this.speedX = 5 * (Math.random() > 0.5 ? 1 : -1);
        this.speedY = 5 * (Math.random() > 0.5 ? 1 : -1);
    }

    public reverseX(): void {
        this.speedX = -this.speedX * 1.1; // Increase speed slightly
    }

    public reverseY(): void {
        this.speedY = -this.speedY;
    }

    public collidesWith(paddle: Paddle): boolean {
        return this.x >= paddle.x && 
               this.x <= paddle.x + paddle.width &&
               this.y >= paddle.y &&
               this.y <= paddle.y + paddle.height;
    }
}

class Score {
    public player1: number = 0;
    public player2: number = 0;
} 