import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { CATEGORIAS_FATO, type Fato } from '../types'
import { getFatos } from '../services/fatosService'
import { TICKER_REGEX, normalizarTicker } from '../lib/tickers'

/** Query string de `GET /ativos/:ticker/fatos`, com valores padrão do PRD. */
const QuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(10),
  categoria: z.union([z.literal('all'), z.enum(CATEGORIAS_FATO)]).default('all'),
  dias: z.coerce.number().int().min(1).max(365).default(90),
})

/**
 * Rotas de fatos relevantes: comunicados de um ativo com filtros.
 * @param app Instância do Fastify (registrada com prefixo `/api`).
 */
export async function fatosRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/ativos/:ticker/fatos?limite=10&categoria=all&dias=90 — comunicados recentes.
   */
  app.get<{ Params: { ticker: string }; Querystring: Record<string, string | undefined> }>(
    '/ativos/:ticker/fatos',
    async (req, reply: FastifyReply): Promise<Fato[] | FastifyReply> => {
      const ticker = normalizarTicker(req.params.ticker)
      if (!TICKER_REGEX.test(ticker)) {
        return reply.code(400).send({ erro: 'Ticker inválido. Exemplo: PETR4' })
      }
      const query = QuerySchema.safeParse(req.query)
      if (!query.success) {
        return reply
          .code(400)
          .send({ erro: 'Parâmetros inválidos. Use limite (1 a 50), categoria e dias (1 a 365)' })
      }
      const { limite, categoria, dias } = query.data
      return getFatos(ticker, limite, { categoria, dias })
    },
  )
}
