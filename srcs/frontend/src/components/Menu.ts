import { Router } from '../router/Router';

interface UserData {
    id: number;
    email: string;
    username: string;
    status: string;
    accessToken: string;
    refreshToken: string;
}

export class Menu {
    private container: HTMLElement;
    private router: Router;
    private userData: UserData | null = null;

    constructor(container: HTMLElement, router: Router) {
        this.container = container;
        this.router = router;
        this.handleGoogleCallback();
        this.loadUserData();
        this.render();
    }

    private loadUserData(): void {
        console.log('Loading user data...');
        const storedData = localStorage.getItem('user_data');
        if (storedData) {
            console.log('Found user data in localStorage:', storedData);
            try {
                this.userData = JSON.parse(storedData);
                console.log('Loaded user data:', this.userData);
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.userData = null;
            }
        } else {
            console.log('No user data found in localStorage');
            this.userData = null;
        }
    }

    private handleGoogleCallback(): void {
        console.log('Handling Google callback...');
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('data');
        
        if (data) {
            console.log('Found data in URL:', data);
            try {
                // Decode the base64 string, handling URL-safe base64
                const base64Data = data.replace(/-/g, '+').replace(/_/g, '/');
                const decodedData = JSON.parse(atob(base64Data)) as UserData;
                console.log('Decoded user data:', decodedData);
                this.userData = decodedData;
                
                // Store user data in localStorage
                localStorage.setItem('user_data', JSON.stringify(decodedData));
                
                // Remove the data parameter from URL and update the page
                window.history.replaceState({}, document.title, '/');
                console.log('Updated URL and rendering menu...');
                this.render();
            } catch (error) {
                console.error('Error parsing user data:', error);
                // Try to get user data from localStorage as fallback
                this.loadUserData();
            }
        } else {
            console.log('No data in URL, loading from localStorage...');
            this.loadUserData();
        }
    }

    private isAuthenticated(): boolean {
        const userData = localStorage.getItem('user_data');
        if (!userData) {
            console.log('No user data found in localStorage');
            return false;
        }

        try {
            const parsedData = JSON.parse(userData) as UserData;
            const hasTokens = Boolean(parsedData.accessToken && parsedData.refreshToken);
            console.log('Checking authentication:', { 
                hasUserData: true, 
                hasTokens,
                userData: parsedData 
            });
            return hasTokens;
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    }

    public render(): void {
        const isAuth = this.isAuthenticated();
        console.log('Rendering menu, isAuth:', isAuth, 'userData:', this.userData);
        
        this.container.innerHTML = `
            <div class="menu-container">
                <h1 class="menu-title">DUCKONG</h1>
                ${isAuth && this.userData ? `
                    <div class="user-info">
                        <span class="username">${this.userData.username}</span>
                        <span class="status ${this.userData.status}">${this.userData.status}</span>
                    </div>
                ` : ''}
                <div class="menu-buttons">
                    <button class="menu-button" id="local-game">LOCAL GAME</button>
                    <button class="menu-button" id="local-tournament">LOCAL TOURNAMENT</button>
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
                            <button class="google-login-button" id="googleLogin">
                                <img src="/google-icon.svg" alt="Google Icon" class="google-icon">
                                Login with Google
                            </button>
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
            const userData = localStorage.getItem('user_data');
            if (!userData) {
                console.error('No user data found');
                return;
            }

            const parsedData = JSON.parse(userData) as UserData;
            console.log('Loading user stats for user:', parsedData);
            const response = await fetch('/api/user/stats', {
                headers: {
                    'Authorization': `Bearer ${parsedData.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const stats = await response.json();
                console.log('Received user stats:', stats);
                const winsElement = document.getElementById('wins');
                const rankElement = document.getElementById('rank');

                if (winsElement) winsElement.textContent = stats.wins.toString();
                if (rankElement) rankElement.textContent = stats.rank || '-';
            } else {
                console.error('Failed to load user stats:', response.status);
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    private addEventListeners(): void {
        const localGameBtn = document.getElementById('local-game');
        const localTournamentBtn = document.getElementById('local-tournament');
        const onlineGameBtn = document.getElementById('online-game');
        const tournamentBtn = document.getElementById('tournament');
        const settingsBtn = document.getElementById('settings');
        const loginBtn = document.getElementById('login');
        const registerBtn = document.getElementById('register');
        const logoutBtn = document.getElementById('logout');
        const googleLoginBtn = document.getElementById('googleLogin');

        if (localGameBtn) {
            localGameBtn.addEventListener('click', () => {
                this.router.navigate('/game/local');
            });
        }

        if (localTournamentBtn) {
            localTournamentBtn.addEventListener('click', () => {
                this.router.navigate('/game/local-tournament');
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

        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => {
                window.location.href = '/api/auth/google';
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    const userData = localStorage.getItem('user_data');
                    if (!userData) {
                        console.error('No user data found for logout');
                        return;
                    }

                    const parsedData = JSON.parse(userData) as UserData;
                    console.log('Logging out user:', parsedData);
                    const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${parsedData.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        console.log('Logout successful');
                    } else {
                        console.error('Logout failed:', response.status);
                    }
                } catch (error) {
                    console.error('Error during logout:', error);
                } finally {
                    localStorage.removeItem('user_data');
                    this.userData = null;
                    this.render();
                }
            });
        }
    }
} 