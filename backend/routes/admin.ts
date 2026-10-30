import type { FastifyInstance, FastifyReply } from 'fastify'
import { env } from '../lib/env'
import { NOME_FILA, obterFila } from '../jobs/coletaHistorico'

/** Estado da fila de coleta retornado pelo painel. */
interface StatusFila {
  fila: string
  contagens: Record<string, number>
  agendamentos: { nome: string; cron: string | null; proximaExecucao: string | null }[]
}

/**
 * Rotas administrativas. Protegidas por API key no header `x-api-key` (variável `ADMIN_API_KEY`).
 * @param app Instância do Fastify (registrada sem prefixo).
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /admin/jobs/status — contagens da fila de coleta e próximos agendamentos.
   */
  app.get(
    '/admin/jobs/status',
    async (req, reply: FastifyReply): Promise<StatusFila | FastifyReply> => {
      if (!env.ADMIN_API_KEY) {
        return reply
          .code(503)
          .send({ erro: 'Painel administrativo desabilitado (ADMIN_API_KEY ausente)' })
      }
      if (req.headers['x-api-key'] !== env.ADMIN_API_KEY) {
        return reply.code(401).send({ erro: 'Não autorizado' })
      }

      const fila = obterFila()
      const [contagens, repetidos] = await Promise.all([
        fila.getJobCounts(),
        fila.getRepeatableJobs(),
      ])
      return {
        fila: NOME_FILA,
        contagens,
        agendamentos: repetidos.map((r) => ({
          nome: r.name,
          cron: r.pattern ?? null,
          proximaExecucao: r.next ? new Date(r.next).toISOString() : null,
        })),
      }
    },
  )
}
