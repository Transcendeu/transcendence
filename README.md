# Transcendence

A modern web application featuring user authentication, game functionality, and secure infrastructure.

## Project Overview

Transcendence is a full-stack web application that implements various features including:
- Secure user authentication with 2FA support
- User management system
- Online game functionality
- Protected infrastructure with ModSecurity and WAF

## Architecture

The project consists of multiple services:
- Frontend web application
- Authentication service (api/auth)
- User management service (api/user)
- Game service (api/game)
- Nginx web server with security features

## Features

### Frontend

- [x] Tailwind CSS

### Authentication (api/auth) - Fer
- [x] Two-Factor Authentication (2FA)
- [x] JWT-based authentication
- [x] Google OAuth integration

![FIXED] - Faltando session token não salvo no localstorage.

![FIXED] - /register retornando 400. 

![FIXED] - Senha não encriptada no frontend.

### Game Service (api/game) / Remote Player - Nico
- [ ] Real-time game communication
- [ ] Match history and statistics
- [ ] Game database implementation

### Infrastructure
- [x] Nginx web server configuration
- [x] ModSecurity implementation
- [x] Web Application Firewall (WAF)
- [x] Frontend deployment setup
- [x] Vault Hashicorp

### CLI - Mark
- [ ] Replacing Basic Pong with Server-Side Pong and Implementing an API
- [ ] Enabling Pong Gameplay via CLI against Web Users with API Integration

### - Deploy em Prod
- [ ] duckong.net - Vercel

## Setup Instructions

### Prerequisites
- Docker
- Docker Compose
- Make

### Running the Project

1. Clone the repository
2. Build the containers:
   ```bash
   make build
   ```
3. Start the services:
   ```bash
   make up
   ```

### Available Commands

- `make up` - Start all services in detached mode
- `make down` - Stop all services
- `make build` - Build all Docker containers
- `make logs` - View logs from the auth service
- `make clean` - Remove all containers, images, and node_modules
- `make re` - Clean and restart the project

### Development

To view the logs of the authentication service:
```bash
make logs
```

To stop the services:
```bash
make down
```

To clean up and start fresh:
```bash
make re
```

## Security Features

The application implements several security measures:
- ModSecurity for web application firewall
- WAF (Web Application Firewall) protection
- Secure authentication with 2FA
- JWT-based session management

## References

- [Securing Nginx Server using ModSecurity OWASP WAF](https://medium.com/codelogicx/securing-nginx-server-using-modsecurity-oswaf-7ba79906d84c)

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

[Add your license information here]

https://tcdmodules.vercel.app/v14?state=100966471

## Codeowners

* @alineagq
* @Ferskys
* @iW90
* @nicolasprudencio
* @pragmatic-antithesis 
