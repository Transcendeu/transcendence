import { Router } from './router/Router';
import { Menu } from './components/Menu';
import { PongGame } from './components/PongGame';
import { NotFound } from './components/NotFound';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Settings } from './components/Settings';
import { LocalTournament } from './components/LocalTournament';

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
            console.log('Rendering root route');
            this.container.innerHTML = '';
            const menu = new Menu(this.container, this.router);
            menu.render();
        });

        this.router.addRoute('/menu', () => {
            console.log('Rendering menu route');
            this.container.innerHTML = '';
            const menu = new Menu(this.container, this.router);
            menu.render();
        });

        this.router.addRoute('/login', () => {
            console.log('Rendering login route');
            this.container.innerHTML = '';
            new Login(this.container, this.router);
        });

        this.router.addRoute('/register', () => {
            console.log('Rendering register route');
            this.container.innerHTML = '';
            new Register(this.container, this.router);
        });

        // Game routes
        this.router.addRoute('/game/local', () => {
            console.log('Rendering local game route');
            this.container.innerHTML = '';
            return this.startLocalGame();
        });

        this.router.addRoute('/game/local-tournament', () => {
            console.log('Rendering local tournament route');
            this.container.innerHTML = '';
            new LocalTournament(this.container, this.router);
        });

        // Protected routes
        this.router.addRoute('/game/online', () => {
            console.log('Rendering online game route');
            this.container.innerHTML = '';
            return this.startOnlineGame();
        }, { requiresAuth: true });

        this.router.addRoute('/tournament', () => {
            console.log('Rendering tournament route');
            this.container.innerHTML = '';
            return this.startTournament();
        }, { requiresAuth: true });

        this.router.addRoute('/settings', () => {
            console.log('Rendering settings route');
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