import axios from 'axios'
import { z } from 'zod'
import type { AtivoPreco } from '../types'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'
import { PRECO_TTL, cache } from '../lib/cache'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'
import { getCotacoesYahoo, getPrecoYahoo } from './yahooService'

/** Cotações buscadas em paralelo por lote, para não sobrecarregar a brapi. */
const LOTE_COTACOES = 1

const brapiHttp = axios.create({
  baseURL: 'https://brapi.dev/api',
  timeout: 8000,
  headers: { 'User-Agent': 'IBovespa-Dashboard/1.0' },
})

const QuoteRespostaSchema = z.object({
  results: z.array(
    z.object({
      symbol: z.string(),
      shortName: z.string().optional(),
      longName: z.string().optional(),
      regularMarketPrice: z.number().positive(),
      regularMarketChange: z.number(),
      regularMarketChangePercent: z.number(),
      regularMarketVolume: z.number().nonnegative(),
      marketCap: z.number().nullable().optional(),
    }),
  ),
})

/**
 * Monta os query params de autenticação. O token só é enviado se configurado.
 * @returns Objeto de params para o axios.
 */
function paramsAutenticacao(): Record<string, string> {
  return env.BRAPI_TOKEN ? { token: env.BRAPI_TOKEN } : {}
}

/**
 * Busca a cotação de um ativo na brapi (sem cache).
 * Sem `BRAPI_TOKEN`, a brapi só atende alguns tickers de exemplo; os demais voltam 404 (retorna null).
 * @param ticker Ticker normalizado, ex.: "PETR4".
 * @returns Cotação do ativo ou null se a brapi não o retornar.
 * @throws Erro de rede, de autenticação ou resposta fora do schema esperado.
 */
export async function buscarQuoteBrapi(ticker: string): Promise<AtivoPreco | null> {
  try {
    const { data } = await brapiHttp.get<unknown>(`/quote/${ticker}`, {
      params: paramsAutenticacao(),
    })
    const resposta = QuoteRespostaSchema.parse(data)
    const q = resposta.results.find((r) => normalizarTicker(r.symbol) === ticker)
    if (!q) return null
    return {
      ticker,
      nome: q.longName ?? q.shortName ?? ticker,
      preco: q.regularMarketPrice,
      variacao: q.regularMarketChange,
      variacaoPercent: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      marketCap: q.marketCap ?? null,
    }
  } catch (erro: unknown) {
    if (axios.isAxiosError(erro) && erro.response?.status === 404) return null
    throw erro
  }
}

/**
 * Retorna a cotação atual de um ativo. Usa cache (PRECO_TTL) e cai para o Yahoo Finance
 * quando a brapi falha ou não retorna o ativo.
 * @param ticker Ticker do ativo, ex.: "PETR4" (aceita também "PETR4.SA").
 * @returns Cotação do ativo ou null se nenhuma fonte conhecer o ticker.
 * @throws Erro se o Yahoo Finance falhar no fallback.
 */
export async function getPrecoAtivo(ticker: string): Promise<AtivoPreco | null> {
  const t = normalizarTicker(ticker)
  return cache.getOrSet(`preco:${t}`, PRECO_TTL, async (): Promise<AtivoPreco | null> => {
    try {
      const ativo = await buscarQuoteBrapi(t)
      if (ativo) return ativo
    } catch (erro: unknown) {
      logger.error({ err: erro, ticker: t }, 'Falha ao buscar preço na brapi')
    }
    return getPrecoYahoo(t)
  })
}

/**
 * Retorna as cotações dos 50 ativos do IBovespa (lista fixa em `ATIVOS_IBOVESPA`).
 * Tenta a brapi ativo a ativo (cada um com cache próprio); os que faltarem vão para o Yahoo
 * em uma única chamada em lote. A lista inteira fica em cache por PRECO_TTL.
 * @returns Cotações disponíveis, na ordem da lista IBovespa.
 * @throws Erro se nenhum ativo tiver cotação (não grava cache vazio).
 */
export async function getListaIbovespa(): Promise<AtivoPreco[]> {
  return cache.getOrSet('lista:ibovespa', PRECO_TTL, async (): Promise<AtivoPreco[]> => {
    const tickers = ATIVOS_IBOVESPA.map((a) => a.ticker)
    const encontrados = new Map<string, AtivoPreco>()

    for (let i = 0; i < tickers.length; i += LOTE_COTACOES) {
      const lote = tickers.slice(i, i + LOTE_COTACOES)
      const respostas = await Promise.allSettled(
        lote.map((t) => cache.getOrSet(`preco:${t}`, PRECO_TTL, () => buscarQuoteBrapi(t))),
      )
      respostas.forEach((resposta, j) => {
        if (resposta.status === 'fulfilled' && resposta.value) {
          encontrados.set(lote[j], resposta.value)
        } else if (resposta.status === 'rejected') {
          logger.error({ err: resposta.reason, ticker: lote[j] }, 'Falha na brapi para o ativo')
        }
      })
    }

    const faltantes = tickers.filter((t) => !encontrados.has(t))
    if (faltantes.length > 0) {
      try {
        const doYahoo = await getCotacoesYahoo(faltantes)
        for (const ativo of doYahoo) encontrados.set(ativo.ticker, ativo)
      } catch (erro: unknown) {
        logger.error({ err: erro, total: faltantes.length }, 'Falha no fallback Yahoo da lista')
      }
    }

    const cotacoes = tickers.flatMap((t) => {
      const ativo = encontrados.get(t)
      return ativo ? [ativo] : []
    })
    if (cotacoes.length === 0) {
      throw new Error('Nenhuma cotação disponível para os ativos do IBovespa')
    }
    logger.debug({ total: cotacoes.length, faltantes: faltantes.length }, 'lista IBovespa montada')
    return cotacoes
  })
}
