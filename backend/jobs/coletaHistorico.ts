import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import type { Candle } from '../types'
import { prisma } from '../lib/db'
import { env } from '../lib/env'
import { logger } from '../lib/logger'
import { Sentry, deveIgnorarErro } from '../lib/sentry'
import { buscarCandlesYahoo } from '../services/yahooService'

/** Nome da fila BullMQ de coleta. */
export const NOME_FILA = 'coleta'

/** Nome do job diário de coleta. */
export const JOB_COLETA_DIARIA = 'coleta-diaria'

/** Quantidade de dias buscados a cada coleta (cobre feriados e falhas de um dia). */
const DIAS_COLETA = 5

/** Cron do agendamento: 19:30, de segunda a sexta, horário de Brasília (após o fechamento). */
const PADRAO_CRON = '30 19 * * 1-5'

/** Resultado de uma rodada de coleta. */
export interface ResultadoColeta {
  ok: number
  falhas: number
}

let fila: Queue | null = null

/**
 * Conexão Redis dedicada às filas. BullMQ exige `maxRetriesPerRequest: null`,
 * diferente da conexão do cache, que falha rápido quando o Redis está fora.
 * @returns Cliente ioredis para o BullMQ.
 */
function criarConexao(): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

/**
 * Retorna a fila de coleta, criando-a na primeira chamada.
 * @returns Fila BullMQ `coleta`.
 */
export function obterFila(): Queue {
  if (!fila) {
    fila = new Queue(NOME_FILA, { connection: criarConexao() })
  }
  return fila
}

/**
 * Grava os candles de um ativo em PrecoHistorico. Usa upsert por (ativoId, timestamp),
 * então rodar a coleta de novo não duplica registros.
 * @param ativoId Id do ativo na tabela Ativo.
 * @param candles Candles diários a gravar.
 * @returns Quantidade de candles processados.
 * @throws Erro do Prisma se a gravação falhar.
 */
export async function salvarCandles(ativoId: number, candles: readonly Candle[]): Promise<number> {
  for (const c of candles) {
    const timestamp = new Date(c.timestamp)
    const valores = {
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: BigInt(Math.round(c.volume)),
    }
    await prisma.precoHistorico.upsert({
      where: { ativoId_timestamp: { ativoId, timestamp } },
      update: valores,
      create: { ativoId, timestamp, ...valores },
    })
  }
  return candles.length
}

/**
 * Coleta os últimos dias de todos os ativos cadastrados. Falha em um ativo é logada
 * e não interrompe os demais.
 * @returns Quantidade de ativos coletados com sucesso e com falha.
 */
export async function coletarTodos(): Promise<ResultadoColeta> {
  const ativos = await prisma.ativo.findMany({
    select: { id: true, ticker: true },
    orderBy: { ticker: 'asc' },
  })
  const resultado: ResultadoColeta = { ok: 0, falhas: 0 }

  for (const ativo of ativos) {
    const inicio = Date.now()
    try {
      const candles = await buscarCandlesYahoo(ativo.ticker, DIAS_COLETA, '1d')
      await salvarCandles(ativo.id, candles)
      resultado.ok++
      logger.info(`Coletando ${ativo.ticker}... ok (${Date.now() - inicio}ms)`)
    } catch (erro: unknown) {
      resultado.falhas++
      logger.error({ err: erro, ticker: ativo.ticker }, `Coletando ${ativo.ticker}... falhou`)
    }
  }
  return resultado
}

/**
 * Processa jobs da fila de coleta.
 * @param job Job recebido do BullMQ.
 * @returns Resultado da coleta quando o job for `coleta-diaria`.
 */
async function processar(job: Job): Promise<ResultadoColeta | undefined> {
  if (job.name === JOB_COLETA_DIARIA) {
    return coletarTodos()
  }
  return undefined
}

/**
 * Inicia o worker da coleta e registra o agendamento diário (idempotente: o BullMQ não duplica
 * o job repetido ao reiniciar o servidor).
 * @returns Worker em execução.
 */
export async function iniciarColeta(): Promise<Worker> {
  await obterFila().add(
    JOB_COLETA_DIARIA,
    {},
    {
      repeat: { pattern: PADRAO_CRON, tz: 'America/Sao_Paulo' },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  )

  const worker = new Worker(NOME_FILA, processar, { connection: criarConexao() })
  worker.on('failed', (job: Job | undefined, erro: Error) => {
    logger.error({ err: erro, jobId: job?.id }, 'Job de coleta falhou')
    if (!deveIgnorarErro(erro)) {
      Sentry.captureException(erro, { tags: { job: job?.name ?? 'desconhecido' } })
    }
  })
  logger.info({ cron: PADRAO_CRON, tz: 'America/Sao_Paulo' }, 'Coleta diária agendada')
  return worker
}
