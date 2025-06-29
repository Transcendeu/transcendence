import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RegisterBody {
  p1_id: number;
  p2_id: number;
  p1_score: number;
  p2_score: number;
  winner_id: number;
}

interface Game {
  p1_id: number;
  p2_id: number;
  p1_score: number;
  p2_score: number;
  winner_id: number;
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000';

export async function gameRegisterRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/game-register', async (
    request: FastifyRequest<{ Body: RegisterBody }>,
    reply: FastifyReply
  ) => {
        const {p1_id, p2_id, p1_score, p2_score, winner_id} = request.body;
        if (
          p1_id == null ||
          p2_id == null ||
          p1_score == null ||
          p2_score == null ||
          winner_id == null 
        ) {
            return reply
                    .code(400)
                    .send({ error: 'Campos obrigatórios faltando' });
          }
        try {

          // 1) Cria o resultado do jogo no DB-service
          const registerGameRes = await fetch(`${DB_SERVICE_URL}/games`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p1_id, 
              p2_id, 
              p1_score, 
              p2_score, 
              winner_id
            })
          });

          if (!registerGameRes.ok) {
            const errorData = await registerGameRes.json().catch(() => ({}));
            const message = errorData?.error || 'Failed to register game';
            return reply.code(400).send({ error: message });
          }

          const newGame: Game = await registerGameRes.json();

          return reply
            .code(201)
            .send({
              game: {
                p1_id: newGame.p1_id,
                p2_id: newGame.p2_id,
                p1_score: newGame.p1_score,
                p2_score: newGame.p2_score,
                winner_id: newGame.winner_id,
              }
            });

        } catch (err) {
          console.error('Register error:', err);
          return reply.code(500).send({ error: 'Error processing request' });
        }
  });
}
