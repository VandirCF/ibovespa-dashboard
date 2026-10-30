import { z } from 'zod'
import type { IndicadoresFii } from '@/types'

/** URL base do backend Fastify. Não é segredo; pode ser exposta ao cliente. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const numeroOuNulo = z.number().nullable()

const IndicadoresFiiSchema = z.object({
  ticker: z.string(),
  segmento: z.string().nullable(),
  valorMercado: numeroOuNulo,
  pvp: numeroOuNulo,
  dividendYield: numeroOuNulo,
  ffoYield: numeroOuNulo,
  capRate: numeroOuNulo,
  vacancia: numeroOuNulo,
  qtdImoveis: numeroOuNulo,
  precoM2: numeroOuNulo,
  aluguelM2: numeroOuNulo,
  liquidez: numeroOuNulo,
})

/**
 * Busca os indicadores de um fundo imobiliário.
 * @param ticker Ticker já validado, ex.: "KNRI11".
 * @returns Indicadores do fundo (campos sem dado vêm como null).
 * @throws Error se a API falhar ou o formato da resposta for inesperado.
 */
export async function buscarIndicadoresFii(ticker: string): Promise<IndicadoresFii> {
  const resposta = await fetch(`${API_URL}/api/fiis/${ticker}/indicadores`)
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar os indicadores do fundo (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return IndicadoresFiiSchema.parse(dados)
}
