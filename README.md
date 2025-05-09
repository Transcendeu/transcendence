# transcendence
Go go Horseranger

# TODO:

- [x] Corrigir a infra:
    - [x] Criar um segundo nginx para servir de wep-application:
        - [x] Configurar ModSecurity
        - [x] Configurar WFA
        - [x] Configurar frontend no webapp
- [ ] Corrigir api/auth:
    - [x] Habilitar 2FA
    - [X] Corrigir o JWT
    - [ ] Habilitar login com Google
- [ ] Criar api/user:
    - [ ] Criar infra e script básico
    - [ ] Migrar o DB de User em api/auth para api/user
- [ ] Criar api/game:
    - [ ] Comunicação de jogo online
    - [ ] Registro de partidas
    - [ ] Criação de DB

# Referencias

https://medium.com/codelogicx/securing-nginx-server-using-modsecurity-oswaf-7ba79906d84c