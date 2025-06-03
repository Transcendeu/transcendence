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
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (storedData && accessToken && refreshToken) {
            console.log('Found user data in localStorage:', storedData);
            try {
                this.userData = JSON.parse(storedData);
                // Ensure tokens are up to date
                if (this.userData) {
                    this.userData.accessToken = accessToken;
                    this.userData.refreshToken = refreshToken;
                }
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
                const decodedData = JSON.parse(atob(base64Data));
                console.log('Decoded user data:', decodedData);

                if (decodedData.requiresTwoFactor) {
                    // Show 2FA input dialog
                    const twoFactorDialog = document.createElement('div');
                    twoFactorDialog.className = 'two-factor-dialog';
                    twoFactorDialog.innerHTML = `
                        <div class="two-factor-content">
                            <h3>Two-Factor Authentication Required</h3>
                            <p>Please enter your 2FA code to complete the login</p>
                            <div class="form-group">
                                <input type="text" id="twoFactorToken" pattern="[0-9]{6}" maxlength="6" placeholder="Enter 6-digit code">
                                <div class="error-message" id="twoFactorError"></div>
                            </div>
                            <button id="verify2FA" class="auth-button">Verify</button>
                        </div>
                    `;

                    document.body.appendChild(twoFactorDialog);

                    const verifyButton = twoFactorDialog.querySelector('#verify2FA');
                    const tokenInput = twoFactorDialog.querySelector('#twoFactorToken') as HTMLInputElement;
                    const errorDisplay = twoFactorDialog.querySelector('#twoFactorError');

                    if (verifyButton && tokenInput && errorDisplay) {
                        verifyButton.addEventListener('click', async () => {
                            try {
                                const response = await fetch('/api/auth/verify-google-2fa', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        tempToken: decodedData.tempToken,
                                        twoFactorToken: tokenInput.value
                                    })
                                });

                                const responseData = await response.json();

                                if (!response.ok) {
                                    throw new Error(responseData.error || 'Verification failed');
                                }

                                // Store user data and tokens
                                localStorage.setItem('user_data', JSON.stringify(responseData));
                                localStorage.setItem('access_token', responseData.accessToken);
                                localStorage.setItem('refresh_token', responseData.refreshToken);

                                // Remove dialog and update page
                                document.body.removeChild(twoFactorDialog);
                                this.userData = responseData;
                                this.render();
                            } catch (error) {
                                errorDisplay.textContent = error instanceof Error ? error.message : 'Verification failed';
                            }
                        });

                        tokenInput.addEventListener('input', (e) => {
                            const input = e.target as HTMLInputElement;
                            input.value = input.value.replace(/[^0-9]/g, '');
                        });
                    }
                } else {
                    // Regular login flow
                    this.userData = decodedData;
                    localStorage.setItem('user_data', JSON.stringify(decodedData));
                    localStorage.setItem('access_token', decodedData.accessToken);
                    localStorage.setItem('refresh_token', decodedData.refreshToken);
                }
                
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
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (!userData || !accessToken || !refreshToken) {
            console.log('Missing authentication data');
            return false;
        }

        try {
            const parsedData = JSON.parse(userData) as UserData;
            const hasTokens = Boolean(accessToken && refreshToken);
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
                                <img src="./assets/google-icon.svg" alt="Google Icon" class="google-icon">
                                Login with Google
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;

        this.addEventListeners();
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
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    this.userData = null;
                    this.render();
                }
            });
        }
    }
} 