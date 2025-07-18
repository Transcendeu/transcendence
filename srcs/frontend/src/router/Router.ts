type RouteCallback = () => void | Promise<void>;

interface RouteConfig {
    callback: RouteCallback;
    requiresAuth?: boolean;
}

export class Router {
    private routes: Map<string, RouteConfig>;
    private notFoundCallback: RouteCallback | null = null;

    constructor() {
        this.routes = new Map();
        window.addEventListener('popstate', () => this.handleRoute());
    }

    public addRoute(path: string, callback: RouteCallback, options: { requiresAuth?: boolean } = {}): void {
        this.routes.set(path, {
            callback,
            requiresAuth: options.requiresAuth
        });
    }

    public setNotFoundHandler(callback: RouteCallback): void {
        this.notFoundCallback = callback;
    }

    public async navigate(path: string): Promise<void> {
        if (window.location.pathname === path) return;
        window.history.pushState({}, '', path);
        await this.handleRoute();
    }

    private async handleRoute(): Promise<void> {
        const path = window.location.pathname;
        const route = this.routes.get(path);

        try {
            if (route) {
//                console.log('Found route:', path, 'requiresAuth:', route.requiresAuth);
                if (route.requiresAuth && !this.isAuthenticated()) {
                    await this.navigate('/login');
                    return;
                }
                await Promise.resolve(route.callback());
            } else if (this.notFoundCallback) {
                await Promise.resolve(this.notFoundCallback());
            } else {
                console.error(`No route found for path: ${path}`);
            }
        } catch (error) {
            console.error('Error handling route:', error);
        }
    }

    private isAuthenticated(): boolean {
        const token = localStorage.getItem('access_token');
        const userData = localStorage.getItem('user_data');
        const isAuth = !!token && !!userData;
//        console.log('Checking authentication in router:', { token: !!token, userData: !!userData, isAuth });
        return isAuth;
    }
}
