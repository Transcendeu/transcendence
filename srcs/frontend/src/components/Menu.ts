import { Router } from '../router/Router';

export class Menu {
    private container: HTMLElement;
    private router: Router;

    constructor(container: HTMLElement, router: Router) {
        this.container = container;
        this.router = router;
        this.render();
    }

    private isAuthenticated(): boolean {
        return !!localStorage.getItem('auth_token');
    }

    private render(): void {
        const isAuth = this.isAuthenticated();
        
        this.container.innerHTML = `
            <div class="menu-container">
                <h1 class="menu-title">DUCKONG</h1>
                <div class="menu-buttons">
                    <button class="menu-button" id="local-game">LOCAL GAME</button>
                    ${isAuth ? `
                        <button class="menu-button" id="online-game">ONLINE GAME</button>
                        <button class="menu-button" id="tournament">TOURNAMENT</button>
                        <button class="menu-button" id="settings">SETTINGS</button>
                        <button class="menu-button danger" id="logout">LOGOUT</button>
                    ` : `
                        <div class="menu-info">
                            <p class="info-text">LOGIN TO ACCESS:</p>
                            <ul class="feature-list">
                                <li>Online Matches</li>
                                <li>Tournament Mode</li>
                                <li>Save Game Stats</li>
                                <li>Global Rankings</li>
                            </ul>
                        </div>
                        <div class="auth-menu">
                            <button class="auth-button" id="login">LOGIN</button>
                            <button class="auth-button" id="register">REGISTER</button>
                        </div>
                    `}
                </div>
                ${isAuth ? `
                    <div class="game-stats">
                        <p class="stats-title">YOUR STATS</p>
                        <div class="stats-content">
                            <div class="stat-item">
                                <span class="stat-label">WINS</span>
                                <span class="stat-value" id="wins">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">RANK</span>
                                <span class="stat-value" id="rank">-</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        this.addEventListeners();
        if (isAuth) {
            this.loadUserStats();
        }
    }

    private async loadUserStats(): Promise<void> {
        try {
            const response = await fetch('/api/user/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                const winsElement = document.getElementById('wins');
                const rankElement = document.getElementById('rank');

                if (winsElement) winsElement.textContent = stats.wins.toString();
                if (rankElement) rankElement.textContent = stats.rank || '-';
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    private addEventListeners(): void {
        const localGameBtn = document.getElementById('local-game');
        const onlineGameBtn = document.getElementById('online-game');
        const tournamentBtn = document.getElementById('tournament');
        const settingsBtn = document.getElementById('settings');
        const loginBtn = document.getElementById('login');
        const registerBtn = document.getElementById('register');
        const logoutBtn = document.getElementById('logout');

        if (localGameBtn) {
            localGameBtn.addEventListener('click', () => {
                this.router.navigate('/game/local');
            });
        }

        if (onlineGameBtn) {
            onlineGameBtn.addEventListener('click', () => {
                this.router.navigate('/game/online');
            });
        }

        if (tournamentBtn) {
            tournamentBtn.addEventListener('click', () => {
                this.router.navigate('/tournament');
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.router.navigate('/settings');
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.router.navigate('/login');
            });
        }

        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                this.router.navigate('/register');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('auth_token');
                this.render();
            });
        }
    }
} 