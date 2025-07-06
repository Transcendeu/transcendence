import { Router } from './router/Router';
import { Menu } from './components/Menu';
import { NotFound } from './components/NotFound';
import { GameManager } from './components/game-component/game-manager';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { GameHistory } from './components/GameHistory';
import { Settings } from './components/Settings';
import { LocalTournament } from './components/LocalTournament';
import { MatchFinder } from './components/game-component/match-finder';


export class App {
    private container: HTMLElement;
    private router: Router;
    private gameManager: GameManager | null = null;


    constructor(container: HTMLElement) {
        this.container = container;
        this.router = new Router();
        this.setupRoutes();
        this.setupNotFound();
        this.showInitialScreen();
        this.gameManager = null;
    }

    private setupRoutes(): void {
        // Public routes
        this.router.addRoute('/', () => {
            this.container.innerHTML = '';
            const menu = new Menu(this.container, this.router);
            menu.render();
        });

        this.router.addRoute('/menu', () => {
            this.container.innerHTML = '';
            const menu = new Menu(this.container, this.router);
            menu.render();
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

        this.router.addRoute('/game/local-tournament', async () => {
            await new Promise(resolve => setTimeout(resolve));
            this.cleanupGameManager();
            this.container.innerHTML = '';
            new LocalTournament(this.container, this.router, {
                setManager: this.setGameManager,
                cleanupManager: this.cleanupGameManager
            });
        });

        // Protected routes
        this.router.addRoute('/game/online', async () => {
            this.container.innerHTML = '';
            await this.startOnlineGame();
        }, { requiresAuth: true });

        this.router.addRoute('/game-history', () => {
            this.container.innerHTML = '';
            new GameHistory(this.container, this.router);
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
        return new Promise(async (resolve) => {
            const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
            const name = userData.username ?? '';
            this.cleanupGameManager();
            this.gameManager = new GameManager(this.container, () => {
                this.router.navigate('/');
                resolve();
                this.cleanupGameManager();
            });
            await this.gameManager.initLocal(name);
        });
    }

    private async startOnlineGame(): Promise<void> {
        type MatchRole = 'player1' | 'player2' | 'spectator';
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        const name = userData.username;

        const matchFinder = new MatchFinder(this.container);
        const matchInfo: { gameId: string | null, role: MatchRole } = await matchFinder.findMatch(name);

        this.cleanupGameManager();

        return new Promise(async (resolve) => {
            this.gameManager = new GameManager(this.container, () => {
                this.cleanupGameManager();
                this.router.navigate('/');
                resolve();
            });

            try {
                await this.gameManager.initOnline(name, matchInfo);
            } catch (err) {
                console.error('Failed to initialize online game:', err);
                this.router.navigate('/menu');
                resolve();
            }
        });
    }


    private showInitialScreen(): void {
        const currentPath = window.location.pathname;
        if (currentPath === '/') {
            new Menu(this.container, this.router);
        } else {
            this.router.navigate(currentPath);
        }
    }

    private setGameManager = (manager: GameManager) => {
        this.gameManager = manager;
    };

    private cleanupGameManager = () => {
        if (this.gameManager) {
            this.gameManager.cleanup();
            this.gameManager = null;
        }
    };
}