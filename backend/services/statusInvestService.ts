import axios from 'axios'
import * as cheerio from 'cheerio'
import type { AtivoPreco, TipoAtivo } from '../types'
import { logger } from '../lib/logger'
import { executarComDelay } from '../lib/throttle'
import { parseNumeroBR } from './fundamentusService'

const URL_BASE = 'https://statusinvest.com.br'
const USER_AGENT = 'IBovespa-Dashboard/1.0'
const TIMEOUT_MS = 10_000

/** TTL da cotação mantida pelo job de atualização (dois ciclos de 5 minutos). */
export const TTL_COTACAO_BACKGROUND = 600

/** TTL do último fechamento lido pelo job, para exibir fora do pregão (7 dias). */
export const TTL_FECHAMENTO = 604800

/**
 * Chave do cache com o último fechamento lido pelo job (exibido fora do horário de pregão).
 * @param ticker Ticker normalizado.
 * @returns Chave Redis.
 */
export function chaveFechamento(ticker: string): string {
  return `fechamento:${ticker}`
}

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
  // O bloco "VOLUME (dia)" não é usado: comparado com a brapi, não corresponde nem a reais
  // nem a quantidade de ações. A liquidez exibida vem do Fundamentus.

  return {
    preco,
    variacao: preco - fechamentoAnterior,
    variacaoPercent,
  }
}

/**
 * Busca a cotação de um papel no Status Invest, respeitando o intervalo entre requisições.
 * Nunca lança erro: devolve null se a página não puder ser lida.
 * @param ticker Ticker normalizado, ex.: PETR4 ou KNRI11.
 * @param tipo Ação (`/acoes/`) ou fundo imobiliário (`/fundos-imobiliarios/`).
 * @returns Cotação do papel ou null.
 */
export async function buscarCotacaoStatusInvest(
  ticker: string,
  tipo: TipoAtivo = 'acao',
): Promise<AtivoPreco | null> {
  const caminho = tipo === 'fii' ? 'fundos-imobiliarios' : 'acoes'
  try {
    const resposta = await executarComDelay(() =>
      axios.get<string>(`${URL_BASE}/${caminho}/${ticker.toLowerCase()}`, {
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
      liquidez: null,
      atualizadoEm: new Date().toISOString(),
      marketCap: null,
      tipo,
    }
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha ao buscar cotação no Status Invest')
    return null
  }
}
