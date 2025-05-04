import { Router } from './router/Router';
import { Menu } from './components/Menu';
import { PongGame } from './components/PongGame';
import { NotFound } from './components/NotFound';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Settings } from './components/Settings';

export class App {
    private container: HTMLElement;
    private router: Router;

    constructor(container: HTMLElement) {
        this.container = container;
        this.router = new Router();
        this.setupRoutes();
        this.setupNotFound();
        this.showInitialScreen();
    }

    private setupRoutes(): void {
        // Public routes
        this.router.addRoute('/', () => {
            this.container.innerHTML = '';
            new Menu(this.container, this.router);
        });

        this.router.addRoute('/login', () => {
            this.container.innerHTML = '';
            new Login(this.container, this.router);
        });

        this.router.addRoute('/register', () => {
            this.container.innerHTML = '';
            new Register(this.container, this.router);
        });

        // Game routes
        this.router.addRoute('/game/local', () => {
            this.container.innerHTML = '';
            return this.startLocalGame();
        });

        // Protected routes
        this.router.addRoute('/game/online', () => {
            this.container.innerHTML = '';
            return this.startOnlineGame();
        }, { requiresAuth: true });

        this.router.addRoute('/tournament', () => {
            this.container.innerHTML = '';
            return this.startTournament();
        }, { requiresAuth: true });

        this.router.addRoute('/settings', () => {
            this.container.innerHTML = '';
            new Settings(this.container, this.router);
        }, { requiresAuth: true });
    }

    private setupNotFound(): void {
        this.router.setNotFoundHandler(() => {
            this.container.innerHTML = '';
            new NotFound(this.container, this.router);
        });
    }

    private async startLocalGame(): Promise<void> {
        return new Promise((resolve) => {
            new PongGame(this.container, () => {
                this.router.navigate('/');
                resolve();
            });
        });
    }

    private async startOnlineGame(): Promise<void> {
        // TODO: Implement online game mode
        this.container.innerHTML = `
            <div class="coming-soon">
                <h2>Online Mode Coming Soon!</h2>
                <p>Challenge players from around the world.</p>
                <button class="menu-button" onclick="window.history.back()">Go Back</button>
            </div>
        `;
        return Promise.resolve();
    }

    private async startTournament(): Promise<void> {
        // TODO: Implement tournament mode
        this.container.innerHTML = `
            <div class="coming-soon">
                <h2>Tournament Mode Coming Soon!</h2>
                <p>Compete in tournaments and climb the global rankings.</p>
                <button class="menu-button" onclick="window.history.back()">Go Back</button>
            </div>
        `;
        return Promise.resolve();
    }

    private showInitialScreen(): void {
        const currentPath = window.location.pathname;
        if (currentPath === '/') {
            new Menu(this.container, this.router);
        } else {
            this.router.navigate(currentPath);
        }
    }
} 