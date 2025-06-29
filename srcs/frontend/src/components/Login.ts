import { Router } from '../router/Router';
import { hashPassword } from '../utils/crypto';

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
                    <div id="twoFactorGroup" class="form-group" style="display: none;">
                        <label for="twoFactorToken">2FA CODE</label>
                        <input type="text" id="twoFactorToken" name="twoFactorToken" pattern="[0-9]{6}" maxlength="6" placeholder="Enter 6-digit code">
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
        const twoFactorGroup = container.querySelector('#twoFactorGroup');
        const twoFactorToken = container.querySelector('#twoFactorToken') as HTMLInputElement;

        if (loginForm && errorDisplay) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;
                const token = formData.get('twoFactorToken') as string;

                // console.log('[Login] Form submitted');
                // console.log('[Login] Username:', username);
                // console.log('[Login] Password (raw):', password);
                // console.log('[Login] 2FA Token:', token);

                try {
                    // Hash the password before sending
                    const hashedPassword = await hashPassword(password);
                    console.log('[Login] Hashed password:', hashedPassword);

                    const bodyPayload = { username, password: hashedPassword } as any;
                    if (token && token.length === 6) {
                        bodyPayload.twoFactorToken = token;
                        console.log('[Login] Sending 2FA token in payload');
                    } else {
                        console.log('[Login] No 2FA token or invalid length, not sending token');
                    }

                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(bodyPayload),
                    });

                    console.log('[Login] Response status:', response.status);
                    const data = await response.json();
                    // console.log('[Login] Response JSON:', data);

                    if (!response.ok) {
                        if (data.requiresTwoFactor) {
                            twoFactorGroup?.setAttribute('style', 'display: block');
                            errorDisplay.textContent = 'Please enter your 2FA code';
                            (errorDisplay as HTMLElement).style.display = 'block';
                            console.warn('[Login] Requires 2FA token');
                            return;
                        }
                        throw new Error(data.error || 'Invalid credentials');
                    }

                    // Store user data and tokens
                    const userData = {
                        id: data.user.id,
                        email: data.user.email,
                        username: data.user.username,
                        status: 'online',
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken
                    };

                    console.log('[Login] Login successful, storing tokens and user data', userData);

                    localStorage.setItem('user_data', JSON.stringify(userData));
                    localStorage.setItem('access_token', data.accessToken);
                    localStorage.setItem('refresh_token', data.refreshToken);

                    // Force a page reload to ensure proper state
                    window.location.href = '/';
                } catch (error) {
                    console.error('[Login] Login failed:', error);
                    errorDisplay.textContent = error instanceof Error ? error.message : 'Login failed';
                    (errorDisplay as HTMLElement).style.display = 'block';
                }
            });
        }

        if (toRegister) {
            toRegister.addEventListener('click', () => {
                console.log('[Login] Navigating to /register');
                this.router.navigate('/register');
            });
        }

        if (twoFactorToken) {
            twoFactorToken.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                const oldVal = input.value;
                input.value = input.value.replace(/[^0-9]/g, '');
                if (input.value !== oldVal) {
                    console.log('[Login] Sanitized 2FA input to:', input.value);
                }
            });
        }
    }
}
