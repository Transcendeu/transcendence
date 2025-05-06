# transcendence
Go go Horseranger

# TODO:

- [ ] Corrigir a infra:
    - [ ] Criar um segundo nginx para servir de wep-application:
        - [ ] Configurar ModSecurity
        - [ ] Configurar WFA
        - [ ] Configurar frontend no webapp
    - [ ] Conectar o webapp com o api-gateway
- [ ] Corrigir api/auth:
 - [ ] Habilitar 2FA
 - [ ] Corrigir o JWT
 - [ ] Habilitar login com Google
- [ ] Criar api/user:
    - [ ] Criar infra e script básico
    - [ ] Migrar o DB de User em api/auth para api/user
- [ ] Criar api/game:
    - [ ] Comunicação de jogo online
    - [ ] Registro de partidas
    - [ ] Criação de DB
