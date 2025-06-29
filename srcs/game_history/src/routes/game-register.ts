import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RegisterBody {
  player1Username: string;
  player2Username: string;
  p1_score: number;
  p2_score: number;
  winnerUsername: string;
}

interface Game {
  p1_id: number;
  p2_id: number;
  p1_score: number;
  p2_score: number;
  winner_id: number;
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

async function getUserIdByUsername(username: string, fastify: FastifyInstance): Promise<number | null> {
  fastify.log.info(`[Game-History] Tentando obter ID para o usuário: ${username}`);
  try {
    const userRes = await fetch(`${DB_SERVICE_URL}/users?emailOrUsername=${encodeURIComponent(username)}`);
    fastify.log.info(`[Game-History] Resposta do DB-service para ${username}: Status ${userRes.status}`);

    if (!userRes.ok) {
      const errorData = await userRes.json().catch(() => ({}));
      fastify.log.warn(`[Game-History] Falha ao obter ID para o usuário '${username}'. Status: ${userRes.status}, Detalhes: ${JSON.stringify(errorData)}`);
      return null;
    }

    const userData = await userRes.json();
    fastify.log.info(`[Game-History] Dados do usuário '${username}' recebidos: ${JSON.stringify(userData)}`);

    if (userData && typeof userData.id === 'number') {
      fastify.log.info(`[Game-History] ID encontrado para '${username}': ${userData.id}`);
      return userData.id;
    }

    fastify.log.warn(`[Game-History] Dados do usuário '${username}' não contêm um ID válido:`, userData);
    return null;

  } catch (error) {
    fastify.log.error(`[Game-History] Erro na requisição para obter ID do usuário '${username}':`, error);
    return null;
  }
}

export async function gameRegisterRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/game-register', async (
    request: FastifyRequest<{ Body: RegisterBody }>,
    reply: FastifyReply
  ) => {
    fastify.log.info(`[Game-History] Requisição POST recebida em /game-register.`);
    fastify.log.info(`[Game-History] Corpo da requisição: ${JSON.stringify(request.body)}`);

    const { player1Username, player2Username, p1_score, p2_score, winnerUsername } = request.body;

    if (
      !player1Username ||
      !player2Username ||
      p1_score == null ||
      p2_score == null ||
      !winnerUsername
    ) {
      fastify.log.warn(`[Game-History] Validação inicial falhou: Campos obrigatórios faltando. Player1: ${player1Username}, Player2: ${player2Username}, Score P1: ${p1_score}, Score P2: ${p2_score}, Vencedor: ${winnerUsername}`);
      return reply
              .code(400)
              .send({ error: 'Dados obrigatórios faltando (usernames ou scores)' });
    }
    fastify.log.info(`[Game-History] Validação inicial bem-sucedida.`);

    try {
      fastify.log.info(`[Game-History] Iniciando busca por IDs de jogadores.`);
      const p1_id = await getUserIdByUsername(player1Username, fastify);
      const p2_id = await getUserIdByUsername(player2Username, fastify);
      fastify.log.info(`[Game-History] IDs de jogadores obtidos: P1_ID: ${p1_id}, P2_ID: ${p2_id}`);

      if (p1_id === null || p2_id === null) {
        fastify.log.warn(`[Game-History] Um ou ambos os jogadores não foram encontrados. P1_ID: ${p1_id}, P2_ID: ${p2_id}`);
        return reply.code(404).send({ error: 'Um ou mais jogadores não foram encontrados no banco de dados.' });
      }

      let winner_id: number;
      if (winnerUsername === player1Username) {
        winner_id = p1_id;
        fastify.log.info(`[Game-History] Vencedor identificado como player1: ${winnerUsername}, ID: ${winner_id}`);
      } else if (winnerUsername === player2Username) {
        winner_id = p2_id;
        fastify.log.info(`[Game-History] Vencedor identificado como player2: ${winnerUsername}, ID: ${winner_id}`);
      } else {
        fastify.log.warn(`[Game-History] Username do vencedor '${winnerUsername}' não corresponde a player1 (${player1Username}) ou player2 (${player2Username}).`);
        return reply.code(400).send({ error: 'Username do vencedor inválido ou não corresponde aos jogadores.' });
      }

      fastify.log.info(`[Game-History] Preparando para enviar dados da partida para o DB-service.`);
      const gameDataToDB = {
        p1_id,
        p2_id,
        p1_score,
        p2_score,
        winner_id
      };
      fastify.log.info(`[Game-History] Dados enviados para DB-service: ${JSON.stringify(gameDataToDB)}`);

      const registerGameRes = await fetch(`${DB_SERVICE_URL}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameDataToDB)
      });
      fastify.log.info(`[Game-History] Resposta do DB-service para /games: Status ${registerGameRes.status}`);


      if (!registerGameRes.ok) {
        const errorData = await registerGameRes.json().catch(() => ({}));
        const message = errorData?.error || 'Falha ao registrar partida no serviço de banco de dados';
        fastify.log.error(`[Game-History] Erro ao registrar partida no DB-service. Status: ${registerGameRes.status}, Mensagem: ${message}, Detalhes: ${JSON.stringify(errorData)}`);
        return reply.code(registerGameRes.status >= 400 && registerGameRes.status < 500 ? registerGameRes.status : 500).send({ error: message });
      }

      const newGame: Game = await registerGameRes.json();
      fastify.log.info(`[Game-History] Partida registrada com sucesso no DB-service. Dados recebidos: ${JSON.stringify(newGame)}`);

      return reply
        .code(201)
        .send({
          message: 'Partida registrada com sucesso!',
          game: {
            // Incluir o ID gerado pela criação do jogo, se disponível na resposta do DB
            p1_id: newGame.p1_id,
            p2_id: newGame.p2_id,
            p1_score: newGame.p1_score,
            p2_score: newGame.p2_score,
            winner_id: newGame.winner_id,
          }
        });

    } catch (err) {
      fastify.log.error(`[Game-History] Erro fatal e inesperado ao processar requisição de registro de partida:`, err);
      return reply.code(500).send({ error: 'Erro interno do servidor ao processar a requisição.' });
    }
  });
}

