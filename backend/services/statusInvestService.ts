import axios from 'axios'
import * as cheerio from 'cheerio'
import type { AtivoPreco } from '../types'
import { logger } from '../lib/logger'
import { executarComDelay } from '../lib/throttle'
import { parseNumeroBR } from './fundamentusService'

const URL_BASE = 'https://statusinvest.com.br/acoes'
const USER_AGENT = 'IBovespa-Dashboard/1.0'
const TIMEOUT_MS = 10_000

/** TTL da cotação mantida pelo job de atualização (dois ciclos de 5 minutos). */
export const TTL_COTACAO_BACKGROUND = 600

/**
 * Chave do cache com a cotação mantida pelo job de atualização.
 * @param ticker Ticker normalizado.
 * @returns Chave Redis.
 */
export function chaveCotacaoBackground(ticker: string): string {
  return `cotacao-bg:${ticker}`
}

/** Cotação e variação do dia, no mesmo formato de AtivoPreco. */
export interface CotacaoStatusInvest {
  preco: number
  variacao: number
  variacaoPercent: number
  /** Volume financeiro do dia em reais (já vem em R$ na fonte). */
  volume: number | null
}

/**
 * Lê preço atual e variação do dia da página de um papel no Status Invest.
 * A variação vem sem sinal no texto; o sinal é dado pelo ícone de seta (arrow_downward = queda).
 * @param html HTML da página `/acoes/{ticker}`.
 * @returns Cotação lida ou null se os campos não existirem.
 */
export function extrairCotacaoStatusInvest(html: string): CotacaoStatusInvest | null {
  const $ = cheerio.load(html)
  const preco = parseNumeroBR($('div[title="Valor atual do ativo"] strong.value').first().text())
  const bloco = $('span[title="Variação do valor do ativo com base no dia anterior"]').first()
  const percentual = parseNumeroBR(bloco.find('b').text())
  if (preco === null || percentual === null) return null

  const emQueda = bloco.find('i').text().trim() === 'arrow_downward'
  const variacaoPercent = emQueda ? -Math.abs(percentual) : Math.abs(percentual)
  // Variação em reais: preço atual menos o fechamento anterior, que sai do percentual.
  const fechamentoAnterior = preco / (1 + variacaoPercent / 100)
  // Volume do dia: o bloco "VOLUME (dia)" traz o valor financeiro em reais.
  const titulo = $('h3.title')
    .filter((_, elemento) => $(elemento).text().trim() === 'VOLUME (dia)')
    .first()
  const volume = parseNumeroBR(titulo.parent().find('strong.value').first().text())

  return {
    preco,
    variacao: preco - fechamentoAnterior,
    variacaoPercent,
    volume,
  }
}

/**
 * Busca a cotação de um papel no Status Invest, respeitando o intervalo entre requisições.
 * Nunca lança erro: devolve null se a página não puder ser lida.
 * @param ticker Ticker normalizado, ex.: PETR4.
 * @returns Cotação do papel ou null.
 */
export async function buscarCotacaoStatusInvest(ticker: string): Promise<AtivoPreco | null> {
  try {
    const resposta = await executarComDelay(() =>
      axios.get<string>(`${URL_BASE}/${ticker.toLowerCase()}`, {
        headers: { 'User-Agent': USER_AGENT },
        responseType: 'text',
        timeout: TIMEOUT_MS,
      }),
    )
    const cotacao = extrairCotacaoStatusInvest(resposta.data)
    if (!cotacao) {
      logger.warn({ ticker }, 'Status Invest sem cotação na página')
      return null
    }
    return {
      ticker,
      nome: ticker,
      preco: cotacao.preco,
      variacao: cotacao.variacao,
      variacaoPercent: cotacao.variacaoPercent,
      volume: cotacao.volume,
      marketCap: null,
    }
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha ao buscar cotação no Status Invest')
    return null
  }
}
