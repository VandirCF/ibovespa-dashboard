import type { Candle, Periodo } from '../types'
import { cache } from '../lib/cache'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'
import { buscarHistoricoBrapi } from './brapiService'
import { CONFIG_PERIODOS, buscarCandlesYahoo } from './yahooService'

/**
 * Retorna o histórico OHLCV de um ativo para o período, com cache por período.
 * Ordem das fontes: Yahoo Finance; se falhar ou vier vazio, brapi.
 * Se as duas falharem, o erro é propagado (e nada é gravado no cache).
 * @param ticker Ticker do ativo, com ou sem `.SA`.
 * @param periodo Um de '1d' | '1w' | '1m' | '3m' | '1y' | '5y'.
 * @returns Candles ordenados do mais antigo para o mais recente.
 * @throws Erro se nenhuma fonte responder.
 */
export async function getHistoricoAtivo(ticker: string, periodo: Periodo): Promise<Candle[]> {
  const t = normalizarTicker(ticker)
  const config = CONFIG_PERIODOS[periodo]

  return cache.getOrSet(`hist:${t}:${periodo}`, config.ttlSegundos, async (): Promise<Candle[]> => {
    try {
      const doYahoo = await buscarCandlesYahoo(t, config.diasAtras, config.intervalo)
      if (doYahoo.length > 0) return doYahoo
      logger.warn({ ticker: t, periodo }, 'Yahoo sem candles; tentando brapi')
    } catch (erro: unknown) {
      logger.error(
        { err: erro, ticker: t, periodo },
        'Yahoo indisponível para o histórico; tentando brapi',
      )
    }
    const daBrapi = await buscarHistoricoBrapi(t, periodo)
    logger.debug({ ticker: t, periodo, total: daBrapi.length }, 'histórico obtido na brapi')
    return daBrapi
  })
}
