import yahooFinance from 'yahoo-finance2'
import { z } from 'zod'
import type { AtivoPreco, Candle, Periodo } from '../types'
import { logger } from '../lib/logger'
import { normalizarTicker, paraSimboloYahoo } from '../lib/tickers'

yahooFinance.suppressNotices(['yahooSurvey'])

/** Configuração de cada período do gráfico: janela de dados, intervalo do candle e TTL do cache. */
interface ConfigPeriodo {
  diasAtras: number
  intervalo: '5m' | '1h' | '1d' | '1wk'
  ttlSegundos: number
}

/** Períodos suportados e suas configurações (TTL conforme TASKS T-006). */
export const CONFIG_PERIODOS: Readonly<Record<Periodo, ConfigPeriodo>> = {
  '1d': { diasAtras: 1, intervalo: '5m', ttlSegundos: 300 },
  '1w': { diasAtras: 7, intervalo: '1h', ttlSegundos: 300 },
  '1m': { diasAtras: 31, intervalo: '1d', ttlSegundos: 1800 },
  '3m': { diasAtras: 92, intervalo: '1d', ttlSegundos: 1800 },
  '1y': { diasAtras: 366, intervalo: '1d', ttlSegundos: 3600 },
  '5y': { diasAtras: 1830, intervalo: '1wk', ttlSegundos: 3600 },
}

const QuoteSchema = z.object({
  symbol: z.string(),
  shortName: z.string().optional(),
  longName: z.string().optional(),
  regularMarketPrice: z.number(),
  regularMarketChange: z.number(),
  regularMarketChangePercent: z.number(),
  regularMarketVolume: z.number().nonnegative(),
  marketCap: z.number().optional(),
})

const CandleSchema = z.object({
  date: z.date(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
})

/**
 * Converte uma cotação do Yahoo para o formato `AtivoPreco`.
 * @param bruto Objeto de cotação retornado por `yahooFinance.quote`.
 * @returns `AtivoPreco` ou null se os dados forem inválidos.
 */
function paraAtivoPreco(bruto: unknown): AtivoPreco | null {
  const parse = QuoteSchema.safeParse(bruto)
  if (!parse.success) return null
  const q = parse.data
  return {
    ticker: normalizarTicker(q.symbol),
    nome: q.longName ?? q.shortName ?? normalizarTicker(q.symbol),
    preco: q.regularMarketPrice,
    variacao: q.regularMarketChange,
    variacaoPercent: q.regularMarketChangePercent,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap ?? null,
  }
}

/**
 * Busca a cotação atual de um ativo no Yahoo Finance (fallback da brapi).
 * @param ticker Ticker do ativo, com ou sem `.SA`.
 * @returns Cotação do ativo ou null se não houver dados válidos.
 * @throws Erro de rede ou da biblioteca yahoo-finance2.
 */
export async function getPrecoYahoo(ticker: string): Promise<AtivoPreco | null> {
  const bruto: unknown = await yahooFinance.quote(paraSimboloYahoo(ticker))
  return paraAtivoPreco(bruto)
}

/**
 * Busca cotações de vários ativos em uma única chamada ao Yahoo Finance.
 * @param tickers Lista de tickers.
 * @returns Cotações válidas (ativos sem dados são omitidos).
 * @throws Erro de rede ou da biblioteca yahoo-finance2.
 */
export async function getCotacoesYahoo(tickers: readonly string[]): Promise<AtivoPreco[]> {
  if (tickers.length === 0) return []
  const brutos: unknown[] = await yahooFinance.quote(tickers.map(paraSimboloYahoo))
  return brutos.map(paraAtivoPreco).filter((ativo): ativo is AtivoPreco => ativo !== null)
}

/**
 * Busca candles OHLCV no Yahoo Finance sem cache. Usado pelo cache de gráficos e pelo job de coleta.
 * @param ticker Ticker, com ou sem `.SA`.
 * @param diasAtras Janela de dias a partir de hoje.
 * @param intervalo Intervalo do candle.
 * @returns Candles válidos ordenados pelo Yahoo (candles com valores nulos são descartados).
 * @throws Erro de rede ou da biblioteca yahoo-finance2.
 */
export async function buscarCandlesYahoo(
  ticker: string,
  diasAtras: number,
  intervalo: ConfigPeriodo['intervalo'],
): Promise<Candle[]> {
  const inicio = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
  const resultado: unknown = await yahooFinance.chart(paraSimboloYahoo(ticker), {
    period1: inicio,
    interval: intervalo,
  })

  const quotes = z.object({ quotes: z.array(z.unknown()) }).parse(resultado).quotes
  const candles: Candle[] = []
  for (const item of quotes) {
    const parse = CandleSchema.safeParse(item)
    if (!parse.success) continue
    const c = parse.data
    if (c.open === null || c.high === null || c.low === null || c.close === null) continue
    candles.push({
      timestamp: c.date.toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
    })
  }
  return candles
}
