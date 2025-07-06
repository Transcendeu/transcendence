import { Router } from '../router/Router';

export class Settings {
    private twoFactorEnabled: boolean = false;

    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'settings-container';

        settingsContainer.innerHTML = `
            <div class="settings-content">
                <h2 class="settings-title">SETTINGS</h2>
                <div class="settings-section">
                    <h3>Two-Factor Authentication</h3>
                    <div id="twoFactorStatus"></div>
                    <div id="twoFactorSetup" style="display: none;">
                        <div class="qr-container">
                            <img id="qrCode" alt="2FA QR Code">
                        </div>
                        <div class="form-group">
                            <label for="twoFactorToken">Enter 6-digit code to verify</label>
                            <input type="text" id="twoFactorToken" name="twoFactorToken" pattern="[0-9]{6}" maxlength="6" placeholder="Enter 6-digit code">
                            <button id="verify2FA" class="settings-button">Verify and Enable 2FA</button>
                        </div>
                    </div>
                    <button id="setup2FA" class="settings-button">Setup 2FA</button>
                </div>
                <div class="settings-links">
                    <button class="text-button" id="backToMenu">BACK TO MENU</button>
                </div>
            </div>
        `;

        this.container.appendChild(settingsContainer);
        this.setupEventListeners(settingsContainer);
        this.load2FAStatus();
    }

    private async load2FAStatus(): Promise<void> {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const refreshResponse = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') })
                    });

                    if (refreshResponse.ok) {
                        const data = await refreshResponse.json();
                        localStorage.setItem('access_token', data.accessToken);
                        return this.load2FAStatus();
                    } else {
                        this.router.navigate('/login');
                        return;
                    }
                }
                throw new Error('Failed to load user data');
            }

            const user = await response.json();
            this.twoFactorEnabled = user.twoFactorEnabled;

            const statusDiv = document.querySelector('#twoFactorStatus');
            if (statusDiv) {
                statusDiv.textContent = this.twoFactorEnabled ? '2FA is enabled' : '2FA is not enabled';
            }

            const setupButton = document.querySelector('#setup2FA');
            if (setupButton) {
                setupButton.textContent = this.twoFactorEnabled ? 'Disable 2FA' : 'Setup 2FA';
            }
        } catch (error) {
            console.error('Error loading 2FA status:', error);
        }
    }

    private setupEventListeners(container: HTMLElement): void {
        const setupButton = container.querySelector('#setup2FA') as HTMLButtonElement;
        const verifyButton = container.querySelector('#verify2FA') as HTMLButtonElement;
        const backButton = container.querySelector('#backToMenu') as HTMLButtonElement;
        const twoFactorToken = container.querySelector('#twoFactorToken') as HTMLInputElement;
        const twoFactorSetup = container.querySelector('#twoFactorSetup');

        if (setupButton) {
            setupButton.addEventListener('click', async () => {
                if (this.twoFactorEnabled) {
                    // DISABLE 2FA
                    try {
                        const response = await fetch('/api/auth/2fa/disable', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                            }
                        });

                        if (!response.ok) {
                            if (response.status === 401) {
                                const refreshResponse = await fetch('/api/auth/refresh', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') })
                                });

                                if (refreshResponse.ok) {
                                    const data = await refreshResponse.json();
                                    localStorage.setItem('access_token', data.accessToken);
                                    setupButton.click();
                                    return;
                                } else {
                                    this.router.navigate('/login');
                                    return;
                                }
                            }
                            throw new Error('Failed to disable 2FA');
                        }

                        await this.load2FAStatus();
                    } catch (err) {
                        console.error('Error disabling 2FA:', err);
                    }
                } else {
                    // ENABLE 2FA (setup)
                    try {
                        const response = await fetch('/api/auth/2fa/setup', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                            }
                        });

                        if (!response.ok) {
                            if (response.status === 401) {
                                const refreshResponse = await fetch('/api/auth/refresh', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') })
                                });

                                if (refreshResponse.ok) {
                                    const data = await refreshResponse.json();
                                    localStorage.setItem('access_token', data.accessToken);
                                    setupButton.click();
                                    return;
                                } else {
                                    this.router.navigate('/login');
                                    return;
                                }
                            }
                            throw new Error('Failed to setup 2FA');
                        }

                        const data = await response.json();
                        const qrCode = document.querySelector('#qrCode') as HTMLImageElement;
                        if (qrCode) {
                            qrCode.src = data.qrCode;
                        }

                        if (twoFactorSetup) {
                            twoFactorSetup.setAttribute('style', 'display: block');
                        }
                    } catch (error) {
                        console.error('Error setting up 2FA:', error);
                    }
                }
            });
        }

        if (verifyButton && twoFactorToken) {
            verifyButton.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/auth/2fa/verify', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ token: twoFactorToken.value })
                    });

                    if (!response.ok) {
                        if (response.status === 401) {
                            const refreshResponse = await fetch('/api/auth/refresh', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') })
                            });

                            if (refreshResponse.ok) {
                                const data = await refreshResponse.json();
                                localStorage.setItem('access_token', data.accessToken);
                                verifyButton.click();
                                return;
                            } else {
                                this.router.navigate('/login');
                                return;
                            }
                        }
                        throw new Error('Failed to verify 2FA');
                    }

                    await this.load2FAStatus();
                    if (twoFactorSetup) {
                        twoFactorSetup.setAttribute('style', 'display: none');
                    }
                    twoFactorToken.value = '';
                } catch (error) {
                    console.error('Error verifying 2FA:', error);
                }
            });
        }

        if (backButton) {
            backButton.addEventListener('click', () => {
                this.router.navigate('/');
            });
        }

        if (twoFactorToken) {
            twoFactorToken.addEventListener('input', (e) => {
                const input = e.target as HTMLInputElement;
                input.value = input.value.replace(/[^0-9]/g, '');
            });
        }
    }
}
