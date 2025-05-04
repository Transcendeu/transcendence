import { Router } from '../router/Router';

export class NotFound {
    constructor(private container: HTMLElement, private router: Router) {
        this.render();
    }

    private render(): void {
        const notFoundContainer = document.createElement('div');
        notFoundContainer.className = 'not-found-container';

        notFoundContainer.innerHTML = `
            <div class="not-found-content">
                <h1 class="glitch-text">404</h1>
                <p class="error-message">SYSTEM MALFUNCTION: PAGE NOT FOUND</p>
                <button class="menu-button" id="backToHome">RETURN TO MAINFRAME</button>
            </div>
        `;

        this.container.appendChild(notFoundContainer);
        
        const backButton = notFoundContainer.querySelector('#backToHome');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.router.navigate('/');
            });
        }
    }
} 