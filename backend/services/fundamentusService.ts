import axios from 'axios'
import * as cheerio from 'cheerio'
import { z } from 'zod'
import { cache } from '../lib/cache'
import { logger } from '../lib/logger'
import { executarComDelay } from '../lib/throttle'

const URL_RESULTADO = 'https://www.fundamentus.com.br/resultado.php'
const URL_DETALHE = 'https://www.fundamentus.com.br/detalhes.php'
const URL_HISTORICO = 'https://www.fundamentus.com.br/amline/cot_hist.php'
const USER_AGENT = 'IBovespa-Dashboard/1.0'
const TIMEOUT_MS = 15_000

/** Cache da tabela completa: o Fundamentus atualiza os dados ao longo do dia. */
export const FUNDAMENTUS_TABELA_TTL = 3600
/** Cache do detalhe por papel (valor de mercado e número de ações). */
export const FUNDAMENTUS_DETALHE_TTL = 86400

/** Indicadores de um papel na tabela de resultados. Percentuais vêm como pontos (6,98 = 6,98%). */
export interface LinhaFundamentus {
  ticker: string
  /** Cotação de fechamento do último pregão (não é tempo real). */
  cotacao: number | null
  pl: number | null
  pvp: number | null
  psr: number | null
  dividendYield: number | null
  pAtivo: number | null
  pCapGiro: number | null
  pEbit: number | null
  pAtivCircLiq: number | null
  evEbit: number | null
  evEbitda: number | null
  margemBruta: number | null
  margemEbit: number | null
  margemLiquida: number | null
  liquidezCorrente: number | null
  roic: number | null
  roe: number | null
  liquidez2Meses: number | null
  patrimonioLiquido: number | null
  dividaLiquidaPl: number | null
  crescimentoReceita5a: number | null
}

/** Dados do detalhe de um papel: valor de mercado e número de ações (em reais e unidades). */
export interface DetalheFundamentus {
  marketCap: number | null
  nroAcoes: number | null
}

/** Ordem das colunas numéricas da tabela de resultados, depois da coluna do papel. */
const CHAVES_COLUNAS = [
  'cotacao',
  'pl',
  'pvp',
  'psr',
  'dividendYield',
  'pAtivo',
  'pCapGiro',
  'pEbit',
  'pAtivCircLiq',
  'evEbit',
  'evEbitda',
  'margemBruta',
  'margemEbit',
  'margemLiquida',
  'liquidezCorrente',
  'roic',
  'roe',
  'liquidez2Meses',
  'patrimonioLiquido',
  'dividaLiquidaPl',
  'crescimentoReceita5a',
] as const

/** Campos em que zero é um valor real. Nos demais, zero no Fundamentus significa "não se aplica". */
const CHAVES_ZERO_VALIDO: readonly string[] = ['dividendYield', 'crescimentoReceita5a', 'cotacao']

const NumeroOuNulo = z.number().nullable()

const LinhaSchema = z.object({
  ticker: z.string().min(1),
  cotacao: NumeroOuNulo,
  pl: NumeroOuNulo,
  pvp: NumeroOuNulo,
  psr: NumeroOuNulo,
  dividendYield: NumeroOuNulo,
  pAtivo: NumeroOuNulo,
  pCapGiro: NumeroOuNulo,
  pEbit: NumeroOuNulo,
  pAtivCircLiq: NumeroOuNulo,
  evEbit: NumeroOuNulo,
  evEbitda: NumeroOuNulo,
  margemBruta: NumeroOuNulo,
  margemEbit: NumeroOuNulo,
  margemLiquida: NumeroOuNulo,
  liquidezCorrente: NumeroOuNulo,
  roic: NumeroOuNulo,
  roe: NumeroOuNulo,
  liquidez2Meses: NumeroOuNulo,
  patrimonioLiquido: NumeroOuNulo,
  dividaLiquidaPl: NumeroOuNulo,
  crescimentoReceita5a: NumeroOuNulo,
})

/**
 * Converte um número no formato brasileiro ("2.542.630.000,00", "-25,48", "6,98%") em número.
 * @param texto Texto da célula.
 * @returns Número ou null para vazio, "-" ou valor inválido.
 */
export function parseNumeroBR(texto: string): number | null {
  const limpo = texto.replace(/\s/g, '').replace('%', '')
  if (limpo === '' || limpo === '-') return null
  const valor = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

/**
 * Lê a tabela de resultados do Fundamentus (todos os papéis).
 * @param html HTML de resultado.php já decodificado (ISO-8859-1).
 * @returns Linhas validadas, uma por papel.
 */
export function extrairLinhasFundamentus(html: string): LinhaFundamentus[] {
  const $ = cheerio.load(html)
  const linhas: LinhaFundamentus[] = []

  $('table#resultado tbody tr').each((_, elemento) => {
    const celulas = $(elemento).children('td')
    const ticker = celulas.first().text().trim()
    if (!ticker || celulas.length < CHAVES_COLUNAS.length + 1) return

    const valores: Record<string, number | null | string> = { ticker }
    CHAVES_COLUNAS.forEach((chave, indice) => {
      const valor = parseNumeroBR(celulas.eq(indice + 1).text())
      // Zero aqui significa "não se aplica" (ex.: EV/EBITDA de bancos), exceto no dividend yield e no crescimento.
      const zeroTemSignificado = CHAVES_ZERO_VALIDO.includes(chave)
      valores[chave] = valor === 0 && !zeroTemSignificado ? null : valor
    })
    const validado = LinhaSchema.safeParse(valores)
    if (validado.success) {
      linhas.push(validado.data)
    } else {
      logger.debug(
        { ticker, erros: validado.error.issues.length },
        'linha do Fundamentus descartada',
      )
    }
  })

  return linhas
}

/**
 * Lê valor de mercado e número de ações da página de detalhe de um papel.
 * Procura o rótulo seguido de um número, para não confundir com o texto da dica (tooltip).
 * @param html HTML de detalhes.php já decodificado (ISO-8859-1).
 * @returns Valor de mercado e número de ações (null se ausentes).
 */
export function extrairDetalheFundamentus(html: string): DetalheFundamentus {
  const texto = cheerio.load(html)('body').text().replace(/\s+/g, ' ')
  const ler = (rotulo: string): number | null => {
    const casamento = new RegExp(`${rotulo}\\s+(-?[\\d.]+(?:,\\d+)?)`).exec(texto)
    return casamento ? parseNumeroBR(casamento[1]) : null
  }
  return {
    marketCap: ler('Valor de mercado'),
    nroAcoes: ler('Nro\\. Ações'),
  }
}

/**
 * Baixa uma página do Fundamentus respeitando o intervalo entre requisições.
 * @param url URL completa da página.
 * @returns HTML decodificado em ISO-8859-1.
 * @throws Erro de rede ou HTTP.
 */
async function baixarPagina(url: string): Promise<string> {
  const resposta = await executarComDelay(() =>
    axios.get<ArrayBuffer>(url, {
      headers: { 'User-Agent': USER_AGENT },
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
    }),
  )
  return new TextDecoder('iso-8859-1').decode(resposta.data)
}

/**
 * Retorna a tabela de resultados do Fundamentus indexada por ticker, com cache de 1 hora.
 * Falhas retornam mapa vazio e não são gravadas no cache.
 * @returns Mapa de ticker para indicadores.
 */
export async function getTabelaFundamentus(): Promise<Map<string, LinhaFundamentus>> {
  const emCache = await cache.get<LinhaFundamentus[]>('fundamentus:tabela')
  let linhas = emCache
  if (linhas === null) {
    try {
      linhas = extrairLinhasFundamentus(await baixarPagina(URL_RESULTADO))
    } catch (erro: unknown) {
      logger.error({ err: erro }, 'Falha ao buscar a tabela do Fundamentus')
      return new Map()
    }
    if (linhas.length > 0) await cache.set('fundamentus:tabela', linhas, FUNDAMENTUS_TABELA_TTL)
  }
  return new Map(linhas.map((linha) => [linha.ticker, linha]))
}

/** Cache da série diária de um papel. */
export const FUNDAMENTUS_HISTORICO_TTL = 3600

/** Série de fechamentos diários: pares [timestamp em ms, fechamento]. */
const SerieHistoricoSchema = z.array(z.tuple([z.number(), z.number()]))

/** Ponto da série diária do Fundamentus. Só há fechamento: não existe abertura, máxima, mínima nem volume. */
export interface PontoHistoricoFundamentus {
  /** Data do pregão em ms desde a época. */
  timestamp: number
  /** Fechamento do pregão. */
  fechamento: number
}

/**
 * Retorna a série diária de fechamentos de um papel no Fundamentus, com cache de 1 hora.
 * O endpoint exige o Referer da página de cotações; sem ele responde vazio.
 * @param ticker Ticker normalizado, ex.: VALE3.
 * @returns Pontos ordenados do mais antigo para o mais recente; vazio em caso de falha.
 */
export async function getHistoricoFundamentus(
  ticker: string,
): Promise<PontoHistoricoFundamentus[]> {
  const chave = `fundamentus:historico:${ticker}`
  const emCache = await cache.get<PontoHistoricoFundamentus[]>(chave)
  if (emCache !== null) return emCache

  try {
    const url = `${URL_HISTORICO}?papel=${encodeURIComponent(ticker)}`
    const resposta = await executarComDelay(() =>
      axios.get<string>(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: `${URL_RESULTADO.replace('resultado.php', 'cotacoes.php')}?papel=${encodeURIComponent(ticker)}`,
        },
        responseType: 'text',
        timeout: TIMEOUT_MS,
      }),
    )
    const serie = SerieHistoricoSchema.parse(JSON.parse(resposta.data))
    const pontos = serie.map(([timestamp, fechamento]) => ({ timestamp, fechamento }))
    if (pontos.length > 0) await cache.set(chave, pontos, FUNDAMENTUS_HISTORICO_TTL)
    return pontos
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha ao buscar o histórico de cotações no Fundamentus')
    return []
  }
}

/**
 * Retorna valor de mercado e número de ações de um papel, com cache de 24 horas.
 * @param ticker Ticker normalizado, ex.: PETR4.
 * @returns Detalhe do papel; campos nulos se a página não puder ser lida.
 */
export async function getDetalheFundamentus(ticker: string): Promise<DetalheFundamentus> {
  const chave = `fundamentus:detalhe:${ticker}`
  const emCache = await cache.get<DetalheFundamentus>(chave)
  if (emCache !== null) return emCache

  try {
    const url = `${URL_DETALHE}?papel=${encodeURIComponent(ticker)}`
    const detalhe = extrairDetalheFundamentus(await baixarPagina(url))
    if (detalhe.marketCap !== null) await cache.set(chave, detalhe, FUNDAMENTUS_DETALHE_TTL)
    return detalhe
  } catch (erro: unknown) {
    logger.error({ err: erro, ticker }, 'Falha ao buscar o detalhe do papel no Fundamentus')
    return { marketCap: null, nroAcoes: null }
  }
}

const URL_FII_RESULTADO = 'https://www.fundamentus.com.br/fii_resultado.php'

/** Dados de um fundo imobiliário na tabela de FIIs. Percentuais vêm como pontos (8,76 = 8,76%). */
export interface LinhaFii {
  ticker: string
  /** Nome curto do fundo (sem a razão social padrão). */
  nome: string
  segmento: string | null
  /** Cotação de fechamento do último pregão. */
  cotacao: number | null
  ffoYield: number | null
  dividendYield: number | null
  pvp: number | null
  valorMercado: number | null
  /** Liquidez média diária em reais. */
  liquidez: number | null
  qtdImoveis: number | null
  precoM2: number | null
  aluguelM2: number | null
  capRate: number | null
  vacancia: number | null
}

/** Ordem das colunas numéricas da tabela de FIIs, depois de papel e segmento. */
const CHAVES_COLUNAS_FII = [
  'cotacao',
  'ffoYield',
  'dividendYield',
  'pvp',
  'valorMercado',
  'liquidez',
  'qtdImoveis',
  'precoM2',
  'aluguelM2',
  'capRate',
  'vacancia',
] as const

/** Campos de FII em que zero é real: fundo de papel não tem imóveis e vacância de 0% existe. */
const CHAVES_ZERO_VALIDO_FII: readonly string[] = ['dividendYield', 'qtdImoveis', 'vacancia']

const LinhaFiiSchema = z.object({
  ticker: z.string().min(1),
  nome: z.string().min(1),
  segmento: z.string().nullable(),
  cotacao: NumeroOuNulo,
  ffoYield: NumeroOuNulo,
  dividendYield: NumeroOuNulo,
  pvp: NumeroOuNulo,
  valorMercado: NumeroOuNulo,
  liquidez: NumeroOuNulo,
  qtdImoveis: NumeroOuNulo,
  precoM2: NumeroOuNulo,
  aluguelM2: NumeroOuNulo,
  capRate: NumeroOuNulo,
  vacancia: NumeroOuNulo,
})

/**
 * Encurta o nome do fundo removendo a razão social padrão.
 * Ex.: "KINEA RENDA IMOBILIÁRIA FUNDO DE INVESTIMENTO IMOBILIÁRIO ..." → "KINEA RENDA IMOBILIÁRIA".
 * @param nome Nome completo da tabela.
 * @returns Nome curto (ou o original, se a remoção esvaziar o texto).
 */
export function nomeCurtoFii(nome: string): string {
  const curto = nome
    .replace(/\s*-?\s*(FUNDO DE INVESTIMENTO IMOBILI[ÁA]RIO|FUNDO IMOBILI[ÁA]RIO|\bFII\b).*$/i, '')
    .trim()
  return curto || nome.trim()
}

/**
 * Lê a tabela de fundos imobiliários do Fundamentus.
 * @param html HTML de fii_resultado.php já decodificado (ISO-8859-1).
 * @returns Linhas validadas, uma por fundo.
 */
export function extrairLinhasFii(html: string): LinhaFii[] {
  const $ = cheerio.load(html)
  const linhas: LinhaFii[] = []

  $('table#tabelaResultado tr').each((_, elemento) => {
    const celulas = $(elemento).children('td')
    if (celulas.length < CHAVES_COLUNAS_FII.length + 2) return
    const primeira = celulas.first()
    const ticker = primeira.text().trim()
    if (!ticker) return

    const valores: Record<string, number | string | null> = {
      ticker,
      nome: nomeCurtoFii(primeira.find('span').attr('title') ?? ticker),
      segmento: celulas.eq(1).text().trim() || null,
    }
    CHAVES_COLUNAS_FII.forEach((chave, indice) => {
      const valor = parseNumeroBR(celulas.eq(indice + 2).text())
      valores[chave] = valor === 0 && !CHAVES_ZERO_VALIDO_FII.includes(chave) ? null : valor
    })
    const validado = LinhaFiiSchema.safeParse(valores)
    if (validado.success) linhas.push(validado.data)
  })

  return linhas
}

/**
 * Retorna a tabela de fundos imobiliários do Fundamentus indexada por ticker, com cache de 1 hora.
 * Falhas retornam mapa vazio e não são gravadas no cache.
 * @returns Mapa de ticker para dados do fundo.
 */
export async function getTabelaFiis(): Promise<Map<string, LinhaFii>> {
  let linhas = await cache.get<LinhaFii[]>('fundamentus:fiis')
  if (linhas === null) {
    try {
      linhas = extrairLinhasFii(await baixarPagina(URL_FII_RESULTADO))
    } catch (erro: unknown) {
      logger.error({ err: erro }, 'Falha ao buscar a tabela de FIIs do Fundamentus')
      return new Map()
    }
    if (linhas.length > 0) await cache.set('fundamentus:fiis', linhas, FUNDAMENTUS_TABELA_TTL)
  }
  return new Map(linhas.map((linha) => [linha.ticker, linha]))
}

/**
 * Indica se o ticker é de um fundo imobiliário (presente na tabela de FIIs do Fundamentus).
 * Units de ações (ex.: TAEE11) também terminam em 11, por isso o sufixo não basta.
 * @param ticker Ticker normalizado.
 * @returns true se for FII.
 */
export async function ehFii(ticker: string): Promise<boolean> {
  return (await getTabelaFiis()).has(ticker)
}
