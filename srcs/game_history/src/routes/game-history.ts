import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

interface HistoryParams {
  userId: string
}

interface GameHistoryEntry {
  id: number
  p1_id: number
  p1_username: string
  p2_id: number
  p2_username: string
  p1_score: number
  p2_score: number
  winner_id: number
  winner_username: string
  created_at: string
}

const DB_SERVICE_URL = process.env.DATABASE_URL || 'http://database:5000'

export async function gameHistoryRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Params: HistoryParams
  }>('/games/users/:userId/history', async (
    request:  FastifyRequest<{ Params: HistoryParams }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params
    fastify.log.info(`[Game-History] GET games/users/${userId}/history`)

    if (!userId) {
      fastify.log.warn('[Game-History] Falta userId na URL')
      return reply.code(400).send({ error: 'ID do usuário é obrigatório' })
    }

    try {
      const res = await fetch(`${DB_SERVICE_URL}/games/users/${userId}/history`)
      fastify.log.info(`[Game-History] Resposta do DB-service: ${res.status}`)

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        fastify.log.error('[Game-History] Erro ao buscar histórico:', res.status, errBody)
        return reply
          .code(res.status >= 400 && res.status < 500 ? res.status : 500)
          .send({ error: errBody.error || 'Falha ao obter histórico de partidas' })
      }

      const history: GameHistoryEntry[] = await res.json()
      return reply.code(200).send({ history })
    } catch (err) {
      fastify.log.error('[Game-History] Erro interno ao buscar histórico:', err)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}