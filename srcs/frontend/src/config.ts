export const config = {
    apiBaseUrl: process.env.NODE_ENV === 'production' 
        ? 'http://localhost/api'  // In production, the frontend will be served by web-nginx
        : 'http://localhost:80/api', // In development, direct access to api-gateway
    wsBaseUrl: process.env.NODE_ENV === 'production'
        ? 'ws://localhost/ws'
        : 'ws://localhost:80/ws'
}; 