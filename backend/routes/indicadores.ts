import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Indicadores } from '../types'
import { getIndicadores } from '../services/indicadoresService'
import { TICKER_REGEX, normalizarTicker } from '../lib/tickers'

/**
 * Rotas de indicadores fundamentalistas do ativo.
 * @param app Instância do Fastify (registrada com prefixo `/api`).
 */
export async function indicadoresRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/ativos/:ticker/indicadores — P/L, P/VP, DY, ROE, margem, dívida/EBITDA e valor de mercado.
   */
  app.get<{ Params: { ticker: string } }>(
    '/ativos/:ticker/indicadores',
    async (req, reply: FastifyReply): Promise<Indicadores | FastifyReply> => {
      const ticker = normalizarTicker(req.params.ticker)
      if (!TICKER_REGEX.test(ticker)) {
        return reply.code(400).send({ erro: 'Ticker inválido. Exemplo: PETR4' })
      }
      return getIndicadores(ticker)
    },
  )
}
