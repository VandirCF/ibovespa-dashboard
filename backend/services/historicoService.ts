import type { Candle, Periodo } from '../types'
import { cache } from '../lib/cache'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'
import { buscarHistoricoBrapi } from './brapiService'
import { getHistoricoFundamentus, type PontoHistoricoFundamentus } from './fundamentusService'
import { CONFIG_PERIODOS, buscarCandlesYahoo } from './yahooService'

/**
 * Data civil (AAAA-MM-DD) de um timestamp no fuso de Brasília.
 * @param iso Timestamp ISO 8601.
 * @returns Data no formato AAAA-MM-DD.
 */
function dataBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Mantém apenas os candles do último pregão disponível (1D = sessão do dia, não 24 horas).
 * @param candles Candles intradiários ordenados do mais antigo para o mais recente.
 * @returns Candles cuja data em Brasília é a mesma do último candle.
 */
export function somenteUltimoPregao(candles: readonly Candle[]): Candle[] {
  if (candles.length === 0) return []
  const ultimoDia = dataBrasilia(candles[candles.length - 1].timestamp)
  return candles.filter((c) => dataBrasilia(c.timestamp) === ultimoDia)
}

/** Dias corridos cobertos por cada período do gráfico. */
const DIAS_POR_PERIODO: Readonly<Record<Periodo, number>> = {
  '1d': 1,
  '1w': 7,
  '1m': 31,
  '3m': 92,
  '1y': 366,
  '5y': 1830,
}

/**
 * Converte a série de fechamentos do Fundamentus em candles do período pedido.
 * A fonte não tem abertura, máxima, mínima nem volume: cada candle usa o fechamento nos quatro
 * preços e volume zero, então o gráfico mostra só o fechamento de cada pregão.
 * @param pontos Série diária ordenada do mais antigo para o mais recente.
 * @param periodo Período do gráfico.
 * @param agora Data de referência (injetável para testes).
 * @returns Candles dos pregões dentro do período.
 */
export function candlesDoFundamentus(
  pontos: readonly PontoHistoricoFundamentus[],
  periodo: Periodo,
  agora: Date = new Date(),
): Candle[] {
  const inicio = agora.getTime() - DIAS_POR_PERIODO[periodo] * 24 * 60 * 60 * 1000
  return pontos
    .filter((ponto) => ponto.timestamp >= inicio)
    .map((ponto) => ({
      timestamp: new Date(ponto.timestamp).toISOString(),
      open: ponto.fechamento,
      high: ponto.fechamento,
      low: ponto.fechamento,
      close: ponto.fechamento,
      volume: 0,
    }))
}

/**
 * Retorna o histórico OHLCV de um ativo para o período, com cache por período.
 * Ordem das fontes: Yahoo Finance; se falhar ou vier vazio, brapi.
 * Para 1D, retorna somente o pregão mais recente (não uma janela de 24 horas).
 * Se as duas fontes falharem, o erro é propagado (e nada é gravado no cache).
 * @param ticker Ticker do ativo, com ou sem `.SA`.
 * @param periodo Um de '1d' | '1w' | '1m' | '3m' | '1y' | '5y'.
 * @returns Candles ordenados do mais antigo para o mais recente.
 * @throws Erro se nenhuma fonte responder.
 */
export async function getHistoricoAtivo(ticker: string, periodo: Periodo): Promise<Candle[]> {
  const t = normalizarTicker(ticker)
  const config = CONFIG_PERIODOS[periodo]

  return cache.getOrSet(`hist:${t}:${periodo}`, config.ttlSegundos, async (): Promise<Candle[]> => {
    let candles: Candle[] = []
    try {
      candles = await buscarCandlesYahoo(t, config.diasAtras, config.intervalo)
      if (candles.length === 0)
        logger.warn({ ticker: t, periodo }, 'Yahoo sem candles; tentando brapi')
    } catch (erro: unknown) {
      logger.error(
        { err: erro, ticker: t, periodo },
        'Yahoo indisponível para o histórico; tentando brapi',
      )
    }
    if (candles.length === 0) {
      try {
        candles = await buscarHistoricoBrapi(t, periodo)
        logger.debug({ ticker: t, periodo, total: candles.length }, 'histórico obtido na brapi')
      } catch (erro: unknown) {
        logger.error({ err: erro, ticker: t, periodo }, 'brapi indisponível para o histórico')
      }
    }

    // Último recurso: série diária do Fundamentus (só fechamentos; não há intradiário).
    if (candles.length === 0 && periodo !== '1d') {
      const pontos = await getHistoricoFundamentus(t)
      candles = candlesDoFundamentus(pontos, periodo)
      if (candles.length > 0) {
        logger.warn({ ticker: t, periodo }, 'histórico obtido no Fundamentus: apenas fechamentos')
      }
    }

    // Sem dados não se grava nada no cache: a próxima chamada tenta de novo.
    if (candles.length === 0 && periodo !== '1d') {
      throw new Error(`Histórico indisponível para ${t}`)
    }
    return periodo === '1d' ? somenteUltimoPregao(candles) : candles
  })
}
