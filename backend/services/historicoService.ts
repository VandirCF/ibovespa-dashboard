import type { Candle, Periodo } from '../types'
import { cache } from '../lib/cache'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'
import { buscarHistoricoBrapi } from './brapiService'
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
      if (candles.length === 0) logger.warn({ ticker: t, periodo }, 'Yahoo sem candles; tentando brapi')
    } catch (erro: unknown) {
      logger.error({ err: erro, ticker: t, periodo }, 'Yahoo indisponível para o histórico; tentando brapi')
    }
    if (candles.length === 0) {
      candles = await buscarHistoricoBrapi(t, periodo)
      logger.debug({ ticker: t, periodo, total: candles.length }, 'histórico obtido na brapi')
    }
    return periodo === '1d' ? somenteUltimoPregao(candles) : candles
  })
}
