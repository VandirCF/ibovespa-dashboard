import axios from 'axios'
import { z } from 'zod'
import type { AtivoPreco, Candle, Periodo } from '../types'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'
import { PRECO_TTL, cache } from '../lib/cache'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { emHorarioDePregao } from '../lib/pregao'
import { normalizarTicker } from '../lib/tickers'
import { cotacaoDoFii } from './fiisService'
import {
  ehFii,
  getTabelaFiis,
  getTabelaFundamentus,
  type LinhaFundamentus,
} from './fundamentusService'
import {
  buscarCotacaoStatusInvest,
  chaveCotacaoBackground,
  chaveFechamento,
} from './statusInvestService'
import { getCotacoesYahoo, getPrecoYahoo } from './yahooService'

/** Cotações buscadas em sequência na brapi, para não estourar o limite de requisições simultâneas. */
const LOTE_COTACOES = 1

/** Último valor bom de cada ativo, usado quando todas as fontes falham (segundos). */
export const TTL_ULTIMO_VALOR = 86400

/** Tempo que um ticker fica marcado como sem acesso na brapi antes de tentar de novo (segundos). */
export const TTL_SEM_ACESSO = 21600

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
      regularMarketTime: z.unknown().optional(),
    }),
  ),
})

/**
 * Chave de cache com o último valor bom de um ativo.
 * @param ticker Ticker normalizado.
 * @returns Chave Redis.
 */
function chaveUltimoValor(ticker: string): string {
  return `ultimo:${ticker}`
}

/**
 * Chave de cache que marca um ticker como sem acesso na brapi (plano sem o ativo).
 * @param ticker Ticker normalizado.
 * @returns Chave Redis.
 */
function chaveSemAcesso(ticker: string): string {
  return `brapi-sem-acesso:${ticker}`
}

/**
 * Converte o horário da cotação informado pela brapi em ISO 8601.
 * @param valor Campo regularMarketTime (texto ISO na brapi; outros formatos são ignorados).
 * @returns Data ISO ou undefined se o valor não for uma data válida.
 */
function dataDaCotacao(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? undefined : data.toISOString()
}

/**
 * Monta os query params de autenticação. O token só é enviado se configurado.
 * @returns Objeto de params para o axios.
 */
function paramsAutenticacao(): Record<string, string> {
  return env.BRAPI_TOKEN ? { token: env.BRAPI_TOKEN } : {}
}

/**
 * Busca a cotação de um ativo na brapi (sem cache e sem tratamento de erro).
 * @param ticker Ticker normalizado, ex.: "PETR4".
 * @returns Cotação do ativo ou null se a brapi não o retornar (404).
 * @throws Erro de rede, de autenticação (401/403) ou resposta fora do schema esperado.
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
      // Liquidez média (2 meses) vem do Fundamentus na montagem da lista.
      liquidez: null,
      marketCap: q.marketCap ?? null,
      atualizadoEm: dataDaCotacao(q.regularMarketTime),
    }
  } catch (erro: unknown) {
    if (axios.isAxiosError(erro) && erro.response?.status === 404) return null
    throw erro
  }
}

/**
 * Consulta a brapi respeitando o registro de tickers sem acesso. Se a brapi recusar o ticker
 * por autenticação/plano (401/403), registra o ticker e retorna null para cair no Yahoo.
 * Outros erros também retornam null, mas são logados.
 * @param ticker Ticker normalizado.
 * @returns Cotação da brapi ou null.
 */
async function consultarBrapi(ticker: string): Promise<AtivoPreco | null> {
  if (await cache.get<boolean>(chaveSemAcesso(ticker))) return null
  try {
    return await buscarQuoteBrapi(ticker)
  } catch (erro: unknown) {
    if (axios.isAxiosError(erro) && [401, 403].includes(erro.response?.status ?? 0)) {
      await cache.set(chaveSemAcesso(ticker), true, TTL_SEM_ACESSO)
      logger.warn(
        { ticker, status: erro.response?.status },
        'brapi sem acesso a este ativo; usando Yahoo por enquanto',
      )
    } else {
      logger.error({ err: erro, ticker }, 'Falha ao consultar a brapi')
    }
    return null
  }
}

/**
 * Grava a cotação como último valor bom do ativo.
 * @param ativo Cotação recém-obtida.
 */
async function registrarUltimoValor(ativo: AtivoPreco): Promise<void> {
  await cache.set(chaveUltimoValor(ativo.ticker), ativo, TTL_ULTIMO_VALOR)
}

/**
 * Lê o último valor bom do ativo, se existir.
 * @param ticker Ticker normalizado.
 * @returns Última cotação conhecida ou null.
 */
async function lerUltimoValor(ticker: string): Promise<AtivoPreco | null> {
  return cache.get<AtivoPreco>(chaveUltimoValor(ticker))
}

/**
 * Obtém a cotação atual de um ativo, sem cache: tenta a brapi e, se não houver resposta, o Yahoo.
 * Nunca lança erro; devolve null se nenhuma fonte responder.
 * @param ticker Ticker normalizado.
 * @returns Cotação fresca ou null.
 */
async function obterCotacaoFresca(ticker: string): Promise<AtivoPreco | null> {
  const daBrapi = await consultarBrapi(ticker)
  if (daBrapi) {
    await registrarUltimoValor(daBrapi)
    return daBrapi
  }

  const daBackground = await cache.get<AtivoPreco>(chaveCotacaoBackground(ticker))
  if (daBackground) return daBackground

  // Durante o pregão, a página do Status Invest traz a cotação do dia. Fora dele, ela mostra o
  // último fechamento sem data, então vale o fechamento guardado pelo job (com a data da leitura).
  const emPregao = emHorarioDePregao()
  const fii = await ehFii(ticker)
  if (emPregao) {
    const daStatusInvest = await buscarCotacaoStatusInvest(ticker, fii ? 'fii' : 'acao')
    if (daStatusInvest) {
      await registrarUltimoValor(daStatusInvest)
      return daStatusInvest
    }
  }

  const fechamento = await cache.get<AtivoPreco>(chaveFechamento(ticker))
  if (!emPregao && fechamento) return fechamento

  try {
    const doYahoo = await getPrecoYahoo(ticker)
    if (doYahoo) {
      await registrarUltimoValor(doYahoo)
      return doYahoo
    }
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha no Yahoo Finance para o ativo')
  }

  if (fechamento) return fechamento

  const doFundamentus = fii
    ? cotacaoDoFii((await getTabelaFiis()).get(ticker))
    : cotacaoDoFundamentus(ticker, (await getTabelaFundamentus()).get(ticker))
  if (doFundamentus) await registrarUltimoValor(doFundamentus)
  return doFundamentus
}

/**
 * Converte a linha do Fundamentus em cotação. A fonte traz só o fechamento do último pregão,
 * então a variação fica nula. A liquidez é a média diária dos últimos 2 meses.
 * @param ticker Ticker normalizado.
 * @param linha Linha do ticker na tabela do Fundamentus, se existir.
 * @returns Cotação de fechamento ou null.
 */
function cotacaoDoFundamentus(
  ticker: string,
  linha: LinhaFundamentus | undefined,
): AtivoPreco | null {
  if (!linha || linha.cotacao === null) return null
  return {
    ticker,
    nome: ticker,
    preco: linha.cotacao,
    variacao: null,
    variacaoPercent: null,
    liquidez: linha.liquidez2Meses,
    marketCap: null,
  }
}

/**
 * Retorna a cotação atual de um ativo. Usa cache (PRECO_TTL). Se nenhuma fonte responder,
 * devolve o último valor bom conhecido.
 * @param ticker Ticker do ativo, ex.: "PETR4" (aceita também "PETR4.SA").
 * @returns Cotação do ativo ou null se não houver nenhum valor conhecido.
 */
export async function getPrecoAtivo(ticker: string): Promise<AtivoPreco | null> {
  const t = normalizarTicker(ticker)
  const fresco = await cache.getOrSet(`preco:${t}`, PRECO_TTL, () => obterCotacaoFresca(t))
  if (fresco) return fresco

  const ultimo = await lerUltimoValor(t)
  if (ultimo) logger.warn({ ticker: t }, 'Sem cotação atual; exibindo o último valor conhecido')
  return ultimo
}

/**
 * Retorna as cotações dos 50 ativos do IBovespa (lista fixa em `ATIVOS_IBOVESPA`).
 * Fluxo: brapi ativo a ativo (pulando os sem acesso) → um único lote no Yahoo para o restante
 * → último valor bom para o que ainda faltar. A lista fica em cache por PRECO_TTL.
 * @returns Cotações disponíveis, na ordem da lista IBovespa.
 * @throws Erro se nenhum ativo tiver cotação nem valor anterior (não grava cache vazio).
 */
export async function getListaIbovespa(): Promise<AtivoPreco[]> {
  return cache.getOrSet('lista:ibovespa', PRECO_TTL, async (): Promise<AtivoPreco[]> => {
    const tickers = ATIVOS_IBOVESPA.map((a) => a.ticker)
    const frescos = new Map<string, AtivoPreco>()

    for (let i = 0; i < tickers.length; i += LOTE_COTACOES) {
      const lote = tickers.slice(i, i + LOTE_COTACOES)
      const respostas = await Promise.allSettled(
        lote.map((t) => cache.getOrSet(`preco:${t}`, PRECO_TTL, () => consultarBrapi(t))),
      )
      respostas.forEach((resposta, j) => {
        if (resposta.status === 'fulfilled' && resposta.value) {
          frescos.set(lote[j], resposta.value)
        }
      })
    }

    const faltantes = tickers.filter((t) => !frescos.has(t))
    if (faltantes.length > 0) {
      try {
        const doYahoo = await getCotacoesYahoo(faltantes)
        for (const ativo of doYahoo) frescos.set(ativo.ticker, ativo)
      } catch (erro: unknown) {
        logger.error(
          { err: erro, total: faltantes.length },
          'Falha no lote do Yahoo; usando último valor conhecido',
        )
      }
    }

    // Cotação com variação mantida pelo job de segundo plano (Status Invest).
    // Fora do pregão, o cache do job expira: usa o fechamento guardado com a data da leitura.
    for (const t of tickers.filter((ticker) => !frescos.has(ticker))) {
      const daBackground =
        (await cache.get<AtivoPreco>(chaveCotacaoBackground(t))) ??
        (await cache.get<AtivoPreco>(chaveFechamento(t)))
      if (daBackground) frescos.set(t, daBackground)
    }

    // Último recurso: fechamento do Fundamentus, sem variação.
    const semCotacao = tickers.filter((t) => !frescos.has(t))
    if (semCotacao.length > 0) {
      const tabela = await getTabelaFundamentus()
      for (const t of semCotacao) {
        const doFundamentus = cotacaoDoFundamentus(t, tabela.get(t))
        if (doFundamentus) frescos.set(t, doFundamentus)
      }
    }

    for (const ativo of frescos.values()) {
      await registrarUltimoValor(ativo)
    }

    const cotacoes: AtivoPreco[] = []
    for (const t of tickers) {
      const ativo = frescos.get(t) ?? (await lerUltimoValor(t))
      if (ativo) cotacoes.push(ativo)
    }

    if (cotacoes.length === 0) {
      throw new Error('Nenhuma cotação disponível para os ativos do IBovespa')
    }
    logger.debug(
      { total: cotacoes.length, frescos: frescos.size, faltantes: faltantes.length },
      'lista IBovespa montada',
    )
    // Liquidez média (2 meses) do Fundamentus para todos: uma única métrica na coluna da lista.
    const tabelaLiquidez = await getTabelaFundamentus()
    return cotacoes.map((ativo) => ({
      ...ativo,
      liquidez: tabelaLiquidez.get(ativo.ticker)?.liquidez2Meses ?? null,
      tipo: 'acao' as const,
    }))
  })
}

/** Parâmetros da brapi (range e interval) para cada período do gráfico. */
const PARAMS_HISTORICO_BRAPI: Readonly<Record<Periodo, { range: string; interval: string }>> = {
  '1d': { range: '1d', interval: '5m' },
  '1w': { range: '5d', interval: '1h' },
  '1m': { range: '1mo', interval: '1d' },
  '3m': { range: '3mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '5y': { range: '5y', interval: '1wk' },
}

const HistoricoRespostaSchema = z.object({
  results: z.array(
    z.object({
      historicalDataPrice: z
        .array(
          z.object({
            date: z.number(),
            open: z.number().nullable(),
            high: z.number().nullable(),
            low: z.number().nullable(),
            close: z.number().nullable(),
            volume: z.number().nullable(),
            adjustedClose: z.number().nullable().optional(),
          }),
        )
        .optional(),
    }),
  ),
})

/**
 * Busca o histórico OHLCV de um ativo na brapi (sem cache). Os preços são ajustados pelo
 * fator adjustedClose / close, para manter a série contínua (dividendos e eventos societários).
 * @param ticker Ticker normalizado, ex.: "MGLU3".
 * @param periodo Período do gráfico.
 * @returns Candles ordenados do mais antigo para o mais recente (candles incompletos são descartados).
 * @throws Erro de rede, de autenticação ou resposta fora do schema esperado.
 */
export async function buscarHistoricoBrapi(ticker: string, periodo: Periodo): Promise<Candle[]> {
  const { range, interval } = PARAMS_HISTORICO_BRAPI[periodo]
  const { data } = await brapiHttp.get<unknown>(`/quote/${ticker}`, {
    params: { range, interval, ...paramsAutenticacao() },
  })
  const resposta = HistoricoRespostaSchema.parse(data)
  const historico = resposta.results[0]?.historicalDataPrice ?? []

  const candles: Candle[] = []
  for (const h of historico) {
    if (h.open === null || h.high === null || h.low === null || h.close === null) continue
    const fator = h.adjustedClose != null && h.close !== 0 ? h.adjustedClose / h.close : 1
    candles.push({
      timestamp: new Date(h.date * 1000).toISOString(),
      open: h.open * fator,
      high: h.high * fator,
      low: h.low * fator,
      close: h.close * fator,
      volume: h.volume ?? 0,
    })
  }
  return candles
}
