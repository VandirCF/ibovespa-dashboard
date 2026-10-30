import type { FastifyInstance, FastifyReply } from 'fastify'
import type { AtivoPreco } from '../types'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'
import { TICKER_REGEX, normalizarTicker } from '../lib/tickers'
import { getListaIbovespa, getPrecoAtivo } from '../services/brapiService'

/** Mensagem genérica para falhas de fonte externa (não expõe detalhes internos). */
const MENSAGEM_INDISPONIVEL = 'Cotações indisponíveis no momento. Tente novamente em instantes.'

/** Setor em pt-BR por ticker, a partir da lista IBovespa. */
const SETOR_POR_TICKER = new Map(ATIVOS_IBOVESPA.map((a) => [a.ticker, a.setor]))

/**
 * Rotas de ativos: lista do IBovespa e cotação individual.
 * @param app Instância do Fastify (registrada com prefixo `/api`).
 */
export async function ativosRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/ativos — lista dos 50 ativos do IBovespa com preço, variação e volume.
   */
  app.get('/ativos', async (_req, reply: FastifyReply): Promise<AtivoPreco[] | FastifyReply> => {
    try {
      const lista = await getListaIbovespa()
      return lista.map((ativo) => ({ ...ativo, setor: SETOR_POR_TICKER.get(ativo.ticker) }))
    } catch (erro: unknown) {
      app.log.error({ err: erro }, 'Falha ao montar lista de ativos')
      return reply.code(503).send({ erro: MENSAGEM_INDISPONIVEL })
    }
  })

  /**
   * GET /api/ativos/:ticker — cotação atual de um ativo.
   */
  app.get<{ Params: { ticker: string } }>(
    '/ativos/:ticker',
    async (req, reply: FastifyReply): Promise<AtivoPreco | FastifyReply> => {
      const ticker = normalizarTicker(req.params.ticker)
      if (!TICKER_REGEX.test(ticker)) {
        return reply.code(400).send({ erro: 'Ticker inválido. Exemplo: PETR4' })
      }
      try {
        const ativo = await getPrecoAtivo(ticker)
        if (!ativo) {
          return reply.code(404).send({ erro: `Ativo ${ticker} não encontrado` })
        }
        return { ...ativo, setor: SETOR_POR_TICKER.get(ticker) }
      } catch (erro: unknown) {
        app.log.error({ err: erro, ticker }, 'Falha ao buscar cotação')
        return reply.code(503).send({ erro: MENSAGEM_INDISPONIVEL })
      }
    },
  )
}
