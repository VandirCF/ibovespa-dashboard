import axios from 'axios'
import { z } from 'zod'
import type { Indicadores } from '../types'
import { FUNDAMENTUS_TTL, cache } from '../lib/cache'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'

const URL_BRAPI = 'https://brapi.dev/api/quote'
/** Módulos da brapi usados no cálculo. Liberados no plano atual. */
const MODULOS = 'defaultKeyStatistics,financialData,balanceSheetHistory'
const TIMEOUT_MS = 10_000

const NumeroOpcional = z.number().nullable().optional()

const BalancoSchema = z
  .object({
    endDate: z.string().optional(),
    shareholdersEquity: NumeroOpcional,
    totalStockholderEquity: NumeroOpcional,
    controllerShareholdersEquity: NumeroOpcional,
  })
  .passthrough()

const ResultadoBrapiSchema = z
  .object({
    marketCap: NumeroOpcional,
    priceEarnings: NumeroOpcional,
    earningsPerShare: NumeroOpcional,
    defaultKeyStatistics: z
      .object({
        priceToBook: NumeroOpcional,
        enterpriseToEbitda: NumeroOpcional,
        enterpriseToRevenue: NumeroOpcional,
        pegRatio: NumeroOpcional,
        dividendYield: NumeroOpcional,
        bookValue: NumeroOpcional,
        trailingEps: NumeroOpcional,
        beta: NumeroOpcional,
      })
      .passthrough()
      .nullable()
      .optional(),
    financialData: z
      .object({
        returnOnEquity: NumeroOpcional,
        returnOnAssets: NumeroOpcional,
        grossMargins: NumeroOpcional,
        ebitdaMargins: NumeroOpcional,
        operatingMargins: NumeroOpcional,
        profitMargins: NumeroOpcional,
        totalDebt: NumeroOpcional,
        totalCash: NumeroOpcional,
        ebitda: NumeroOpcional,
        currentRatio: NumeroOpcional,
        quickRatio: NumeroOpcional,
        revenueGrowth: NumeroOpcional,
        earningsGrowth: NumeroOpcional,
        freeCashflow: NumeroOpcional,
      })
      .passthrough()
      .nullable()
      .optional(),
    balanceSheetHistory: z.unknown().optional(),
  })
  .passthrough()

const RespostaBrapiSchema = z.object({ results: z.array(ResultadoBrapiSchema) })

type ResultadoBrapi = z.infer<typeof ResultadoBrapiSchema>

/**
 * Multiplica uma fração (0.25) por 100 para obter percentual (25). Preserva null.
 * @param fracao Valor em fração.
 * @returns Percentual ou null.
 */
function percentual(fracao: number | null | undefined): number | null {
  return fracao === null || fracao === undefined ? null : fracao * 100
}

/**
 * Divide dois valores somente se o divisor for positivo e ambos existirem.
 * @param numerador Valor do numerador.
 * @param divisor Valor do divisor.
 * @returns Quociente ou null.
 */
function dividir(
  numerador: number | null | undefined,
  divisor: number | null | undefined,
): number | null {
  if (numerador === null || numerador === undefined) return null
  if (divisor === null || divisor === undefined || divisor <= 0) return null
  return numerador / divisor
}

/**
 * Extrai o patrimônio líquido do exercício mais recente do balanço.
 * A brapi pode devolver uma lista direta ou um objeto com `balanceSheetStatements`.
 * @param balanco Valor bruto do módulo balanceSheetHistory.
 * @returns Patrimônio líquido ou null.
 */
export function patrimonioLiquido(balanco: unknown): number | null {
  const lista = z
    .union([z.array(BalancoSchema), z.object({ balanceSheetStatements: z.array(BalancoSchema) })])
    .safeParse(balanco)
  if (!lista.success) return null
  const itens = Array.isArray(lista.data) ? lista.data : lista.data.balanceSheetStatements
  const recente = itens[0]
  if (!recente) return null
  return (
    recente.shareholdersEquity ??
    recente.totalStockholderEquity ??
    recente.controllerShareholdersEquity ??
    null
  )
}

/**
 * Monta os indicadores fundamentalistas a partir dos dados da brapi.
 * Razões e rendimentos vêm em fração e viram percentual. Índices sem denominador válido ficam null.
 * @param ticker Ticker normalizado.
 * @param resultado Dados da brapi para o ativo.
 * @param patrimonio Patrimônio líquido do exercício mais recente.
 * @returns Indicadores do ativo.
 */
export function montarIndicadores(
  ticker: string,
  resultado: ResultadoBrapi | null,
  patrimonio: number | null,
): Indicadores {
  const dks = resultado?.defaultKeyStatistics ?? null
  const fd = resultado?.financialData ?? null
  const valorMercado = resultado?.marketCap ?? null

  const dividaLiquida =
    fd?.totalDebt !== undefined &&
    fd?.totalDebt !== null &&
    fd?.totalCash !== undefined &&
    fd?.totalCash !== null
      ? fd.totalDebt - fd.totalCash
      : null

  return {
    ticker,
    marketCap: valorMercado,
    pl: resultado?.priceEarnings ?? null,
    pvp: dks?.priceToBook ?? null,
    evEbitda: dks?.enterpriseToEbitda ?? null,
    evReceita: dks?.enterpriseToRevenue ?? null,
    peg: dks?.pegRatio ?? null,
    dividendYield: percentual(dks?.dividendYield),
    fcfYield: percentual(dividir(fd?.freeCashflow, valorMercado)),
    roe: percentual(fd?.returnOnEquity),
    roa: percentual(fd?.returnOnAssets),
    margemBruta: percentual(fd?.grossMargins),
    margemEbitda: percentual(fd?.ebitdaMargins),
    margemOperacional: percentual(fd?.operatingMargins),
    margemLiquida: percentual(fd?.profitMargins),
    dividaLiquidaEbitda: dividir(dividaLiquida, fd?.ebitda),
    dividaLiquidaPl: dividir(dividaLiquida, patrimonio),
    liquidezCorrente: fd?.currentRatio ?? null,
    liquidezSeca: fd?.quickRatio ?? null,
    crescimentoReceita: percentual(fd?.revenueGrowth),
    crescimentoLucro: percentual(fd?.earningsGrowth),
    lpa: dks?.trailingEps ?? resultado?.earningsPerShare ?? null,
    vpa: dks?.bookValue ?? null,
    beta: dks?.beta ?? null,
  }
}

/**
 * Busca os módulos fundamentalistas do ativo na brapi.
 * @param ticker Ticker normalizado, ex.: PETR4.
 * @returns Primeiro resultado da resposta ou null em caso de erro.
 */
async function buscarFundamentosBrapi(ticker: string): Promise<{
  resultado: ResultadoBrapi
  patrimonio: number | null
} | null> {
  try {
    const resposta = await axios.get<unknown>(`${URL_BRAPI}/${ticker}`, {
      params: { modules: MODULOS, token: env.BRAPI_TOKEN },
      timeout: TIMEOUT_MS,
    })
    const dados = RespostaBrapiSchema.safeParse(resposta.data)
    const resultado = dados.success ? dados.data.results[0] : undefined
    if (!resultado) {
      logger.warn({ ticker }, 'brapi sem resultado para indicadores')
      return null
    }
    return { resultado, patrimonio: patrimonioLiquido(resultado.balanceSheetHistory) }
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha ao buscar indicadores na brapi')
    return null
  }
}

/**
 * Retorna os indicadores fundamentalistas de um ativo, com cache de 24 horas.
 * Só grava no cache se ao menos um indicador veio preenchido, para não fixar uma falha por um dia.
 * @param ticker Ticker do ativo, com ou sem `.SA`.
 * @returns Indicadores (campos sem dado são null).
 */
export async function getIndicadores(ticker: string): Promise<Indicadores> {
  const t = normalizarTicker(ticker)
  const chave = `fund:${t}`

  const emCache = await cache.get<Indicadores>(chave)
  if (emCache !== null) return emCache

  const dados = await buscarFundamentosBrapi(t)
  const indicadores = montarIndicadores(t, dados?.resultado ?? null, dados?.patrimonio ?? null)

  const algumPreenchido = Object.entries(indicadores).some(
    ([campo, valor]) => campo !== 'ticker' && valor !== null,
  )
  if (algumPreenchido) {
    await cache.set(chave, indicadores, FUNDAMENTUS_TTL)
  }
  return indicadores
}
