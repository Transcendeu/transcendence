import { Router } from '../router/Router';

export class Register {
    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const registerContainer = document.createElement('div');
        registerContainer.className = 'auth-container';

        registerContainer.innerHTML = `
            <div class="auth-content">
                <h2 class="auth-title">REGISTER</h2>
                <form id="registerForm" class="auth-form">
                    <div class="form-group">
                        <label for="username">USERNAME</label>
                        <input type="text" id="username" name="username" required minlength="3" maxlength="20">
                    </div>
                    <div class="form-group">
                        <label for="email">EMAIL</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">PASSWORD</label>
                        <input type="password" id="password" name="password" required minlength="8">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">CONFIRM PASSWORD</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required>
                    </div>
                    <div class="form-error" id="registerError"></div>
                    <button type="submit" class="auth-button">CREATE ACCOUNT</button>
                </form>
                <div class="auth-links">
                    <button class="text-button" id="toLogin">EXISTING USER? LOGIN</button>
                </div>
            </div>
        `;

        this.container.appendChild(registerContainer);
        this.setupEventListeners(registerContainer);
    }

    private setupEventListeners(container: HTMLElement): void {
        const registerForm = container.querySelector('#registerForm');
        const toLogin = container.querySelector('#toLogin');
        const errorDisplay = container.querySelector('#registerError');

        if (registerForm && errorDisplay) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const username = formData.get('username') as string;
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                const confirmPassword = formData.get('confirmPassword') as string;

                if (password !== confirmPassword) {
                    errorDisplay.textContent = 'Passwords do not match';
                    (errorDisplay as HTMLElement).style.display = 'block';
                    return;
                }

                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, email, password }),
                    });

                    if (!response.ok) {
                        throw new Error('Registration failed');
                    }

                    // Automatically log in after successful registration
                    const loginResponse = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, password }),
                    });

                    if (!loginResponse.ok) {
                        throw new Error('Auto-login failed');
                    }

                    const data = await loginResponse.json();
                    
                    // Store user data and tokens
                    const userData = {
                        id: data.user.id,
                        email: data.user.email,
                        username: data.user.username,
                        status: 'online',
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken
                    };
                    
                    localStorage.setItem('user_data', JSON.stringify(userData));
                    localStorage.setItem('access_token', data.accessToken);
                    localStorage.setItem('refresh_token', data.refreshToken);
                    
                    // Redirect to menu with user data
                    const encodedData = btoa(JSON.stringify(userData))
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=+$/, '');
                    
                    window.location.href = `/?data=${encodedData}`;
                } catch (error) {
                    errorDisplay.textContent = error instanceof Error ? error.message : 'Registration failed';
                    (errorDisplay as HTMLElement).style.display = 'block';
                }
            });
        }

        if (toLogin) {
            toLogin.addEventListener('click', () => {
                this.router.navigate('/login');
            });
        }
    }
} 