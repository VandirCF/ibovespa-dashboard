import { z } from 'zod'
import type { Indicadores } from '@/types'

/** URL base do backend Fastify. Não é segredo; pode ser exposta ao cliente. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const numeroOuNulo = z.number().nullable()

const IndicadoresSchema = z.object({
  ticker: z.string(),
  marketCap: numeroOuNulo,
  pl: numeroOuNulo,
  pvp: numeroOuNulo,
  evEbitda: numeroOuNulo,
  evReceita: numeroOuNulo,
  peg: numeroOuNulo,
  dividendYield: numeroOuNulo,
  fcfYield: numeroOuNulo,
  roe: numeroOuNulo,
  roa: numeroOuNulo,
  margemBruta: numeroOuNulo,
  margemEbitda: numeroOuNulo,
  margemOperacional: numeroOuNulo,
  margemLiquida: numeroOuNulo,
  dividaLiquidaEbitda: numeroOuNulo,
  dividaLiquidaPl: numeroOuNulo,
  liquidezCorrente: numeroOuNulo,
  liquidezSeca: numeroOuNulo,
  crescimentoReceita: numeroOuNulo,
  crescimentoLucro: numeroOuNulo,
  lpa: numeroOuNulo,
  vpa: numeroOuNulo,
  beta: numeroOuNulo,
})

/**
 * Busca os indicadores fundamentalistas de um ativo.
 * @param ticker Ticker já validado, ex.: "PETR4".
 * @returns Indicadores (campos sem dado vêm como null).
 * @throws Error se a API falhar ou o formato da resposta for inesperado.
 */
export async function buscarIndicadores(ticker: string): Promise<Indicadores> {
  const resposta = await fetch(`${API_URL}/api/ativos/${ticker}/indicadores`)
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar os indicadores (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return IndicadoresSchema.parse(dados)
}
