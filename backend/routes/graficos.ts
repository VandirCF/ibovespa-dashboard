import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { Candle } from '../types'
import { getHistoricoAtivo } from '../services/historicoService'
import { TICKER_REGEX, normalizarTicker } from '../lib/tickers'

const PeriodoSchema = z.enum(['1d', '1w', '1m', '3m', '1y', '5y']).default('1m')

/** Mensagem genérica para falhas de fonte externa. */
const MENSAGEM_INDISPONIVEL = 'Histórico indisponível no momento. Tente novamente em instantes.'

/**
 * Rotas de gráficos: histórico OHLCV de um ativo.
 * @param app Instância do Fastify (registrada com prefixo `/api`).
 */
export async function graficosRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/ativos/:ticker/historico?periodo=1m — candles OHLCV do período.
   */
  app.get<{ Params: { ticker: string }; Querystring: { periodo?: string } }>(
    '/ativos/:ticker/historico',
    async (req, reply: FastifyReply): Promise<Candle[] | FastifyReply> => {
      const ticker = normalizarTicker(req.params.ticker)
      if (!TICKER_REGEX.test(ticker)) {
        return reply.code(400).send({ erro: 'Ticker inválido. Exemplo: PETR4' })
      }
      const periodo = PeriodoSchema.safeParse(req.query.periodo)
      if (!periodo.success) {
        return reply.code(400).send({ erro: 'Período inválido. Use 1d, 1w, 1m, 3m, 1y ou 5y' })
      }
      try {
        return await getHistoricoAtivo(ticker, periodo.data)
      } catch (erro: unknown) {
        app.log.error({ err: erro, ticker }, 'Falha ao buscar histórico')
        return reply.code(503).send({ erro: MENSAGEM_INDISPONIVEL })
      }
    },
  )
}
