import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { AtivoPreco } from '../types'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'
import { TICKER_REGEX, normalizarTicker } from '../lib/tickers'
import { getListaIbovespa, getPrecoAtivo } from '../services/brapiService'
import { getListaFiis } from '../services/fiisService'
import { ehFii, getTabelaFiis } from '../services/fundamentusService'

/** Mensagem genérica para falhas de fonte externa (não expõe detalhes internos). */
const MENSAGEM_INDISPONIVEL = 'Cotações indisponíveis no momento. Tente novamente em instantes.'

/** Tipo pedido na lista: ações do IBovespa (padrão) ou fundos imobiliários. */
const TipoSchema = z.enum(['acao', 'fii']).default('acao')

/** Nome e setor em pt-BR do cadastro IBovespa, por ticker. */
const CADASTRO_POR_TICKER = new Map(ATIVOS_IBOVESPA.map((a) => [a.ticker, a]))

/**
 * Completa a cotação com nome e setor do cadastro local, quando o ticker estiver nele.
 * @param ativo Cotação vinda de qualquer fonte.
 * @returns Cotação com nome e setor em pt-BR quando disponíveis; sem cadastro, fica como veio.
 */
function comCadastro(ativo: AtivoPreco): AtivoPreco {
  const cadastro = CADASTRO_POR_TICKER.get(ativo.ticker)
  if (!cadastro) return ativo
  return { ...ativo, nome: cadastro.nome, setor: cadastro.setor }
}

/**
 * Rotas de ativos: listas (ações do IBovespa e fundos imobiliários) e cotação individual.
 * @param app Instância do Fastify (registrada com prefixo `/api`).
 */
export async function ativosRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/ativos?tipo=acao|fii — ações do IBovespa (padrão) ou os FIIs mais líquidos.
   */
  app.get<{ Querystring: { tipo?: string } }>(
    '/ativos',
    async (req, reply: FastifyReply): Promise<AtivoPreco[] | FastifyReply> => {
      const tipo = TipoSchema.safeParse(req.query.tipo)
      if (!tipo.success) {
        return reply.code(400).send({ erro: 'Tipo inválido. Use acao ou fii' })
      }
      try {
        if (tipo.data === 'fii') return await getListaFiis()
        return (await getListaIbovespa()).map(comCadastro)
      } catch (erro: unknown) {
        app.log.error({ err: erro, tipo: tipo.data }, 'Falha ao montar lista de ativos')
        return reply.code(503).send({ erro: MENSAGEM_INDISPONIVEL })
      }
    },
  )

  /**
   * GET /api/ativos/:ticker — cotação atual de uma ação ou de um fundo imobiliário.
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
        if (await ehFii(ticker)) {
          const fundo = (await getTabelaFiis()).get(ticker)
          return {
            ...ativo,
            nome: fundo?.nome ?? ativo.nome,
            setor: fundo?.segmento ?? undefined,
            marketCap: ativo.marketCap ?? fundo?.valorMercado ?? null,
            tipo: 'fii',
          }
        }
        return { ...comCadastro(ativo), tipo: 'acao' }
      } catch (erro: unknown) {
        app.log.error({ err: erro, ticker }, 'Falha ao buscar cotação')
        return reply.code(503).send({ erro: MENSAGEM_INDISPONIVEL })
      }
    },
  )
}
