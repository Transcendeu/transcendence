export class DuckGameScreen {
    private container: HTMLElement;
    private score: number = 0;
    private gameTime: number = 60;
    private duck: HTMLElement;
    private timer: number = 0;
    private onGameEnd: () => void;

    constructor(container: HTMLElement, onGameEnd: () => void) {
        this.container = container;
        this.onGameEnd = onGameEnd;
        this.render();
        this.duck = this.createDuck();
        this.container.querySelector('.game-canvas')?.appendChild(this.duck);
        this.startGame();
    }

    private render(): void {
        this.container.innerHTML = `
            <div class="game-container">
                <div class="game-header">
                    <h2>Duck Hunt</h2>
                    <div class="time-remaining">Time Remaining: <span id="timer">60</span>s</div>
                </div>
                <div class="game-canvas"></div>
                <div class="score-board">
                    <div>Score: <span id="current-score">0</span></div>
                    <div>High Score: <span id="high-score">${localStorage.getItem('duckGameHighScore') || 0}</span></div>
                </div>
            </div>
        `;
    }

    private createDuck(): HTMLElement {
        const duck = document.createElement('div');
        duck.className = 'duck';
        duck.style.left = '400px';
        duck.style.top = '300px';
        
        duck.addEventListener('click', () => this.handleDuckClick());
        
        return duck;
    }

    private handleDuckClick(): void {
        this.score++;
        document.getElementById('current-score')!.textContent = this.score.toString();
        this.moveDuck();
    }

    private moveDuck(): void {
        const x = Math.random() * 700 + 50;
        const y = Math.random() * 500 + 50;
        this.duck.style.left = `${x}px`;
        this.duck.style.top = `${y}px`;
    }

    private startGame(): void {
        // Move duck every 2 seconds
        setInterval(() => this.moveDuck(), 2000);

        // Update timer
        this.timer = window.setInterval(() => {
            this.gameTime--;
            document.getElementById('timer')!.textContent = this.gameTime.toString();

            if (this.gameTime <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    private endGame(): void {
        clearInterval(this.timer);
        
        // Update high score if needed
        const currentHighScore = parseInt(localStorage.getItem('duckGameHighScore') || '0');
        if (this.score > currentHighScore) {
            localStorage.setItem('duckGameHighScore', this.score.toString());
        }

        this.onGameEnd();
    }
} 