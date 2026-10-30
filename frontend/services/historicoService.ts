import { z } from 'zod'
import type { Candle, Periodo } from '@/types'

/** URL base do backend Fastify. Não é segredo; pode ser exposta ao cliente. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CandleSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
})

const HistoricoSchema = z.array(CandleSchema)

/**
 * Busca os candles OHLCV de um ativo no período pedido.
 * @param ticker Ticker já validado, ex.: "PETR4".
 * @param periodo Um de '1d' | '1w' | '1m' | '3m' | '1y' | '5y'.
 * @returns Candles ordenados pelo backend.
 * @throws Error se a API falhar ou o formato da resposta for inesperado.
 */
export async function buscarHistorico(ticker: string, periodo: Periodo): Promise<Candle[]> {
  const resposta = await fetch(`${API_URL}/api/ativos/${ticker}/historico?periodo=${periodo}`)
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar o histórico (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return HistoricoSchema.parse(dados)
}
