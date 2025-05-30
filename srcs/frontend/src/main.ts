import { App } from './App';
import './styles/main.css';
import './styles/google-login.css';
import './styles/two-factor.css';

document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
        console.error('Root element not found');
        return;
    }

    new App(rootElement);
}); 