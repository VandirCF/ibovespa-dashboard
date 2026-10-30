import axios from 'axios'
import * as cheerio from 'cheerio'
import { z } from 'zod'
import { CATEGORIAS_FATO, type CategoriaFato, type Fato } from '../types'
import { cache } from '../lib/cache'
import { logger } from '../lib/logger'
import { normalizarTicker } from '../lib/tickers'

/** TTL dos comunicados no cache, em segundos (B3 publica algumas vezes ao dia). */
export const FATOS_TTL = 3600

/** Intervalo mínimo entre requisições ao Investidor10, em milissegundos. */
const DELAY_SCRAPING_MS = 1000

const URL_BASE_INVESTIDOR10 = 'https://investidor10.com.br/acoes'
const USER_AGENT = 'IBovespa-Dashboard/1.0'
const TIMEOUT_MS = 10_000

const FatoSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1),
  categoria: z.enum(CATEGORIAS_FATO),
  dataPublicacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resumo: z.string().nullable(),
  urlOriginal: z.string().url(),
})

/** Filtros opcionais aplicados sobre os comunicados já obtidos. */
export interface FiltrosFatos {
  /** Categoria exata, ou `all` para todas. */
  categoria?: CategoriaFato | 'all'
  /** Mantém somente comunicados publicados nos últimos N dias. */
  dias?: number
}

/** Cadeia que serializa as requisições ao Investidor10 e impõe o intervalo entre elas. */
let filaScraping: Promise<unknown> = Promise.resolve()

/**
 * Executa a tarefa somente após a anterior e após o intervalo mínimo de 1 segundo.
 * @param tarefa Função assíncrona que faz uma requisição ao Investidor10.
 * @returns Resultado da tarefa.
 */
function executarComDelay<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaScraping.then(tarefa)
  filaScraping = resultado
    .catch(() => undefined)
    .then(() => new Promise<void>((resolver) => setTimeout(resolver, DELAY_SCRAPING_MS)))
  return resultado
}

/**
 * Converte a data pt-BR (DD/MM/AAAA) do Investidor10 para ISO (AAAA-MM-DD).
 * @param texto Data exibida no cartão do comunicado.
 * @returns Data ISO, ou null se o texto não estiver no formato esperado.
 */
export function converterDataPtBr(texto: string): string | null {
  const casamento = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  if (!casamento) return null
  return `${casamento[3]}-${casamento[2]}-${casamento[1]}`
}

/**
 * Mapeia o título de um comunicado para uma das categorias do projeto.
 * "Outros Comunicados Não Considerados Fatos Relevantes" é tratado como Outros, não como Fato Relevante.
 * @param titulo Título do comunicado.
 * @returns Categoria correspondente; Outros quando nenhuma regra casar.
 */
export function categorizarFato(titulo: string): CategoriaFato {
  if (/^outros comunicados|não considerados/i.test(titulo)) return 'Outros'
  if (/fato relevante/i.test(titulo)) return 'Fato Relevante'
  if (/resultado|demonstra(ç|c)[õo]es? financeiras|release/i.test(titulo)) return 'Resultado'
  if (/assembleia|\bAG[OE]\b/i.test(titulo)) return 'Assembleia'
  if (/\baviso\b/i.test(titulo)) return 'Aviso'
  return 'Outros'
}

/**
 * Extrai os comunicados do HTML da página de um ativo no Investidor10.
 * Itens que não passam na validação Zod são descartados e registrados em debug.
 * @param html HTML bruto da página `/acoes/{ticker}/`.
 * @returns Comunicados na ordem da página (mais recentes primeiro).
 */
export function extrairFatosDoHtml(html: string): Fato[] {
  const $ = cheerio.load(html)
  const fatos: Fato[] = []

  $('#communications-section .communication-card').each((_, elemento) => {
    const cartao = $(elemento)
    const link = cartao.find('a.btn-download-communication')
    const titulo = cartao.find('.communication-card--content').text().replace(/\s+/g, ' ').trim()
    const dataPublicacao = converterDataPtBr(cartao.find('.communication-card--date').text())
    const urlOriginal = link.attr('data-document-url') ?? link.attr('href') ?? ''
    const id =
      link.attr('data-summary-url')?.match(/\/comunicado\/(\d+)\//)?.[1] ??
      urlOriginal.match(/\/(\d+)\/?$/)?.[1] ??
      ''

    const candidato = {
      id,
      titulo,
      categoria: categorizarFato(titulo),
      dataPublicacao,
      resumo: null,
      urlOriginal,
    }
    const validado = FatoSchema.safeParse(candidato)
    if (validado.success) {
      fatos.push(validado.data)
    } else {
      logger.debug({ titulo, erros: validado.error.issues }, 'comunicado descartado na validação')
    }
  })

  return fatos
}

/**
 * Baixa a página do ativo no Investidor10 e extrai os comunicados.
 * @param ticker Ticker normalizado, ex.: PETR4.
 * @returns Comunicados extraídos.
 * @throws Erro de rede ou HTTP (inclui 403/429, que indicam bloqueio).
 */
async function baixarFatos(ticker: string): Promise<Fato[]> {
  const resposta = await axios.get<string>(`${URL_BASE_INVESTIDOR10}/${ticker.toLowerCase()}/`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: TIMEOUT_MS,
    responseType: 'text',
  })
  return extrairFatosDoHtml(resposta.data)
}

/**
 * Aplica os filtros de categoria e período sobre uma lista de comunicados.
 * @param fatos Comunicados a filtrar.
 * @param filtros Categoria e número de dias.
 * @param hoje Data de referência (padrão: agora). Injetável para testes.
 * @returns Comunicados que atendem aos filtros, na mesma ordem.
 */
export function filtrarFatos(
  fatos: readonly Fato[],
  filtros: FiltrosFatos,
  hoje: Date = new Date(),
): Fato[] {
  const categoria = filtros.categoria ?? 'all'
  const limiteInferior =
    filtros.dias === undefined
      ? null
      : new Date(hoje.getTime() - filtros.dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return fatos.filter((fato) => {
    if (categoria !== 'all' && fato.categoria !== categoria) return false
    if (limiteInferior !== null && fato.dataPublicacao < limiteInferior) return false
    return true
  })
}

/**
 * Retorna os comunicados mais recentes de um ativo, com cache de 1 hora.
 * O cache guarda a lista completa da página; filtros e limite são aplicados depois.
 * Falhas (incluindo bloqueio 403/429) retornam array vazio, são registradas em log
 * e não são gravadas no cache, para que a próxima chamada tente de novo.
 * @param ticker Ticker do ativo, com ou sem `.SA`.
 * @param limite Número máximo de comunicados retornados.
 * @param filtros Categoria e período opcionais.
 * @returns Comunicados filtrados, do mais recente para o mais antigo.
 */
export async function getFatos(
  ticker: string,
  limite = 10,
  filtros: FiltrosFatos = {},
): Promise<Fato[]> {
  const t = normalizarTicker(ticker)
  const chave = `fatos:${t}`

  let todos = await cache.get<Fato[]>(chave)
  if (todos === null) {
    try {
      todos = await executarComDelay(() => baixarFatos(t))
    } catch (erro: unknown) {
      logger.error({ err: erro, ticker: t }, 'Falha ao buscar comunicados no Investidor10')
      return []
    }
    if (todos.length > 0) {
      await cache.set(chave, todos, FATOS_TTL)
    }
  }

  return filtrarFatos(todos, filtros).slice(0, limite)
}
