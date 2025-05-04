import { Router } from '../router/Router';

export class Login {
    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const loginContainer = document.createElement('div');
        loginContainer.className = 'auth-container';

        loginContainer.innerHTML = `
            <div class="auth-content">
                <h2 class="auth-title">LOGIN</h2>
                <form id="loginForm" class="auth-form">
                    <div class="form-group">
                        <label for="username">USERNAME</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">PASSWORD</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <div class="form-error" id="loginError"></div>
                    <button type="submit" class="auth-button">ACCESS SYSTEM</button>
                </form>
                <div class="auth-links">
                    <button class="text-button" id="toRegister">NEW USER? REGISTER</button>
                </div>
            </div>
        `;

        this.container.appendChild(loginContainer);
        this.setupEventListeners(loginContainer);
    }

    private setupEventListeners(container: HTMLElement): void {
        const loginForm = container.querySelector('#loginForm');
        const toRegister = container.querySelector('#toRegister');
        const errorDisplay = container.querySelector('#loginError');

        if (loginForm && errorDisplay) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;

                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, password }),
                    });

                    if (!response.ok) {
                        throw new Error('Invalid credentials');
                    }

                    const data = await response.json();
                    localStorage.setItem('auth_token', data.token);
                    this.router.navigate('/');
                } catch (error) {
                    errorDisplay.textContent = error instanceof Error ? error.message : 'Login failed';
                    errorDisplay.style.display = 'block';
                }
            });
        }

        if (toRegister) {
            toRegister.addEventListener('click', () => {
                this.router.navigate('/register');
            });
        }
    }
} 