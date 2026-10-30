import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import type { AtivoPreco, TipoAtivo } from '../types'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'
import { cache } from '../lib/cache'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { emHorarioDePregao, fimDoUltimoPregao } from '../lib/pregao'
import { Sentry, deveIgnorarErro } from '../lib/sentry'
import { TTL_ULTIMO_VALOR } from '../services/brapiService'
import { selecionarFiisPrincipais } from '../services/fiisService'
import { getTabelaFiis } from '../services/fundamentusService'
import {
  buscarCotacaoStatusInvest,
  chaveCotacaoBackground,
  chaveFechamento,
  TTL_COTACAO_BACKGROUND,
  TTL_FECHAMENTO,
} from '../services/statusInvestService'

/** Nome da fila BullMQ de cotações. */
export const NOME_FILA_COTACOES = 'cotacoes'

/** Nome do job recorrente que atualiza as cotações. */
export const JOB_ATUALIZAR_COTACOES = 'atualizar-cotacoes'

/** Cron: a cada 5 minutos, de segunda a sexta, entre 10h e 18h (horário de Brasília), como o PRD prevê. */
const PADRAO_CRON = '*/5 10-18 * * 1-5'

/** Resultado de uma rodada de atualização. */
export interface ResultadoAtualizacaoCotacoes {
  ok: number
  falhas: number
}

let fila: Queue | null = null

/**
 * Conexão Redis dedicada às filas (BullMQ exige `maxRetriesPerRequest: null`).
 * @returns Cliente ioredis.
 */
function criarConexao(): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

/**
 * Retorna a fila de cotações, criando-a na primeira chamada.
 * @returns Fila BullMQ `cotacoes`.
 */
function obterFila(): Queue {
  if (!fila) {
    fila = new Queue(NOME_FILA_COTACOES, { connection: criarConexao() })
  }
  return fila
}

/**
 * Consulta o Status Invest para as ações do IBovespa e para os FIIs mais líquidos e guarda o
 * resultado no cache. As requisições são sequenciais e respeitam o intervalo de 1 segundo
 * (lib/throttle.ts). Um ativo que falhar não interrompe os demais.
 * @returns Quantidade de cotações atualizadas e de falhas.
 */
export async function atualizarCotacoesBackground(): Promise<ResultadoAtualizacaoCotacoes> {
  const resultado: ResultadoAtualizacaoCotacoes = { ok: 0, falhas: 0 }

  const fiis = selecionarFiisPrincipais((await getTabelaFiis()).values())
  const alvos: { ticker: string; tipo: TipoAtivo }[] = [
    ...ATIVOS_IBOVESPA.map((ativo) => ({ ticker: ativo.ticker, tipo: 'acao' as const })),
    ...fiis.map((fundo) => ({ ticker: fundo.ticker, tipo: 'fii' as const })),
  ]

  // Fora do pregão a página mostra o último fechamento: a leitura recebe a data desse pregão.
  const carimbo = emHorarioDePregao() ? null : fimDoUltimoPregao().toISOString()

  for (const { ticker, tipo } of alvos) {
    const lida = await buscarCotacaoStatusInvest(ticker, tipo)
    const cotacao: AtivoPreco | null = lida && carimbo ? { ...lida, atualizadoEm: carimbo } : lida
    if (cotacao) {
      await cache.set(chaveCotacaoBackground(ticker), cotacao, TTL_COTACAO_BACKGROUND)
      // A última leitura de cada rodada fica disponível por 7 dias: é o fechamento exibido fora do pregão.
      await cache.set(chaveFechamento(ticker), cotacao, TTL_FECHAMENTO)
      await cache.set(`ultimo:${ticker}`, cotacao, TTL_ULTIMO_VALOR)
      resultado.ok++
    } else {
      resultado.falhas++
    }
  }

  logger.info(resultado, 'Cotações em segundo plano atualizadas')
  return resultado
}

/**
 * Processa jobs da fila de cotações.
 * @param job Job recebido do BullMQ.
 * @returns Resultado da rodada quando o job for o de atualização.
 */
async function processar(job: Job): Promise<ResultadoAtualizacaoCotacoes | undefined> {
  if (job.name === JOB_ATUALIZAR_COTACOES) {
    return atualizarCotacoesBackground()
  }
  return undefined
}

/**
 * Registra o job recorrente de cotações e inicia o worker. Também dispara uma rodada imediata,
 * para que a lista já tenha variação do dia logo após o servidor subir.
 * @returns Worker em execução.
 */
export async function iniciarAtualizacaoCotacoes(): Promise<Worker> {
  await obterFila().add(
    JOB_ATUALIZAR_COTACOES,
    {},
    {
      repeat: { pattern: PADRAO_CRON, tz: 'America/Sao_Paulo' },
      removeOnComplete: 20,
      removeOnFail: 50,
    },
  )
  // Rodada imediata ao subir o servidor. Fora do pregão, as leituras recebem a data do último
  // pregão (ver atualizarCotacoesBackground), então o fechamento fica correto mesmo no fim de semana.
  await obterFila().add(JOB_ATUALIZAR_COTACOES, {}, { removeOnComplete: true, removeOnFail: 20 })

  const worker = new Worker(NOME_FILA_COTACOES, processar, { connection: criarConexao() })
  worker.on('failed', (job: Job | undefined, erro: Error) => {
    logger.error({ err: erro, jobId: job?.id }, 'Job de cotações falhou')
    if (!deveIgnorarErro(erro)) {
      Sentry.captureException(erro, { tags: { job: job?.name ?? 'desconhecido' } })
    }
  })
  logger.info({ cron: PADRAO_CRON, tz: 'America/Sao_Paulo' }, 'Atualização de cotações agendada')
  return worker
}
