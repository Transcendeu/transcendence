import { Router } from '../router/Router';

export class GameHistory {
    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const gameHistory = document.createElement('div');
        gameHistory.className = 'not-found-container';

        gameHistory.innerHTML = `
          <div class="game-history-content">
            <h2 class="game-history-title">USER GAME HISTORY</h2>
            <div class="game-history-container">
              <table class="game-history-table">
                <thead class="game-history-thead">
                  <tr>
                    <th class="game-history-th">User</th>
                    <th class="game-history-th">Points</th>
                    <th class="game-history-th">X</th>
                    <th class="game-history-th">Points</th>
                    <th class="game-history-th">Opponent</th>
                    <th class="game-history-th">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="game-history-tr">
                    <td class="game-history-td">duck_master</td>
                    <td class="game-history-td">12</td>
                    <td class="game-history-td">vs</td>
                    <td class="game-history-td">8</td>
                    <td class="game-history-td">enemy_quack</td>
                    <td class="game-history-winner">duck_master</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button id="backToHome" class="back-button">Back to Home</button>
          </div>
        `;

        this.container.appendChild(gameHistory);
        
        const backButton = gameHistory.querySelector('#backToHome');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.router.navigate('/');
            });
        }
    }
} 