import { Router } from '../router/Router';

export class Settings {
    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'settings-container';

        settingsContainer.innerHTML = `
            <div class="settings-content">
                <h2 class="settings-title">SYSTEM SETTINGS</h2>
                <div class="settings-section">
                    <h3>PROFILE</h3>
                    <form id="profileForm" class="settings-form">
                        <div class="form-group">
                            <label for="displayName">DISPLAY NAME</label>
                            <input type="text" id="displayName" name="displayName" required>
                        </div>
                        <div class="form-group">
                            <label for="avatar">AVATAR URL</label>
                            <input type="url" id="avatar" name="avatar">
                        </div>
                        <button type="submit" class="settings-button">UPDATE PROFILE</button>
                    </form>
                </div>

                <div class="settings-section">
                    <h3>GAME PREFERENCES</h3>
                    <form id="preferencesForm" class="settings-form">
                        <div class="form-group">
                            <label for="difficulty">DIFFICULTY</label>
                            <select id="difficulty" name="difficulty">
                                <option value="easy">EASY</option>
                                <option value="medium">MEDIUM</option>
                                <option value="hard">HARD</option>
                            </select>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="soundEnabled" name="soundEnabled">
                                SOUND EFFECTS
                            </label>
                        </div>
                        <div class="form-group checkbox-group">
                            <label>
                                <input type="checkbox" id="musicEnabled" name="musicEnabled">
                                BACKGROUND MUSIC
                            </label>
                        </div>
                        <button type="submit" class="settings-button">SAVE PREFERENCES</button>
                    </form>
                </div>

                <div class="settings-section">
                    <h3>ACCOUNT</h3>
                    <button id="changePassword" class="settings-button warning">CHANGE PASSWORD</button>
                    <button id="logout" class="settings-button danger">LOGOUT</button>
                </div>

                <div class="settings-section">
                    <button id="backToMenu" class="menu-button">RETURN TO MENU</button>
                </div>
            </div>
        `;

        this.container.appendChild(settingsContainer);
        this.setupEventListeners(settingsContainer);
        this.loadUserSettings();
    }

    private async loadUserSettings(): void {
        try {
            const response = await fetch('/api/user/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load settings');
            }

            const settings = await response.json();
            
            // Populate form fields with user settings
            const displayNameInput = document.getElementById('displayName') as HTMLInputElement;
            const avatarInput = document.getElementById('avatar') as HTMLInputElement;
            const difficultySelect = document.getElementById('difficulty') as HTMLSelectElement;
            const soundCheckbox = document.getElementById('soundEnabled') as HTMLInputElement;
            const musicCheckbox = document.getElementById('musicEnabled') as HTMLInputElement;

            if (displayNameInput) displayNameInput.value = settings.displayName || '';
            if (avatarInput) avatarInput.value = settings.avatar || '';
            if (difficultySelect) difficultySelect.value = settings.difficulty || 'medium';
            if (soundCheckbox) soundCheckbox.checked = settings.soundEnabled ?? true;
            if (musicCheckbox) musicCheckbox.checked = settings.musicEnabled ?? true;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    private setupEventListeners(container: HTMLElement): void {
        const profileForm = container.querySelector('#profileForm');
        const preferencesForm = container.querySelector('#preferencesForm');
        const changePasswordBtn = container.querySelector('#changePassword');
        const logoutBtn = container.querySelector('#logout');
        const backToMenuBtn = container.querySelector('#backToMenu');

        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                
                try {
                    const response = await fetch('/api/user/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        },
                        body: JSON.stringify({
                            displayName: formData.get('displayName'),
                            avatar: formData.get('avatar')
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update profile');
                    }
                } catch (error) {
                    console.error('Error updating profile:', error);
                }
            });
        }

        if (preferencesForm) {
            preferencesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                
                try {
                    const response = await fetch('/api/user/preferences', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        },
                        body: JSON.stringify({
                            difficulty: formData.get('difficulty'),
                            soundEnabled: formData.get('soundEnabled') === 'on',
                            musicEnabled: formData.get('musicEnabled') === 'on'
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update preferences');
                    }
                } catch (error) {
                    console.error('Error updating preferences:', error);
                }
            });
        }

        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                // Implement password change modal or navigation
                this.router.navigate('/change-password');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('auth_token');
                this.router.navigate('/login');
            });
        }

        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => {
                this.router.navigate('/');
            });
        }
    }
} 