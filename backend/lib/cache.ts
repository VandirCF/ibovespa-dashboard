import Redis from 'ioredis'
import { env } from './env'
import { logger } from './logger'

/** TTL do preço atual (brapi), em segundos. */
export const PRECO_TTL = 300

/** TTL dos indicadores fundamentalistas, em segundos (dados trimestrais). */
export const FUNDAMENTUS_TTL = 86400

/**
 * Subconjunto da interface do ioredis usado pelo cache.
 * Permite injetar um cliente em memória nos testes.
 */
export interface ClienteRedis {
  get(key: string): Promise<string | null>
  set(key: string, value: string, modo: 'EX', ttlSegundos: number): Promise<unknown>
  del(key: string): Promise<number>
}

/** Interface pública da camada de cache. */
export interface Cache {
  /** Retorna o valor armazenado ou null. Erros do Redis viram cache miss. */
  get<T>(key: string): Promise<T | null>
  /** Armazena o valor serializado em JSON com TTL em segundos. */
  set<T>(key: string, value: T, ttlSegundos: number): Promise<void>
  /** Remove a chave. */
  del(key: string): Promise<void>
  /**
   * Retorna o valor do cache; se ausente, executa `fetchFn`, armazena e retorna.
   * Se o Redis estiver indisponível, executa `fetchFn` sem cache (degradação graciosa).
   */
  getOrSet<T>(key: string, ttlSegundos: number, fetchFn: () => Promise<T>): Promise<T>
}

/**
 * Cria a camada de cache sobre um cliente Redis.
 * @param cliente Cliente compatível com ioredis (real ou mock).
 * @param log Logger usado para hit/miss e erros.
 * @returns Implementação de `Cache`.
 */
export function criarCache(
  cliente: ClienteRedis,
  log: Pick<typeof logger, 'debug' | 'error'> = logger,
): Cache {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const bruto = await cliente.get(key)
        return bruto === null ? null : (JSON.parse(bruto) as T)
      } catch (erro: unknown) {
        log.error({ err: erro, key }, 'Falha ao ler do cache Redis')
        return null
      }
    },

    async set<T>(key: string, value: T, ttlSegundos: number): Promise<void> {
      try {
        await cliente.set(key, JSON.stringify(value), 'EX', ttlSegundos)
      } catch (erro: unknown) {
        log.error({ err: erro, key }, 'Falha ao gravar no cache Redis')
      }
    },

    async del(key: string): Promise<void> {
      try {
        await cliente.del(key)
      } catch (erro: unknown) {
        log.error({ err: erro, key }, 'Falha ao remover do cache Redis')
      }
    },

    async getOrSet<T>(key: string, ttlSegundos: number, fetchFn: () => Promise<T>): Promise<T> {
      const emCache = await this.get<T>(key)
      if (emCache !== null) {
        log.debug({ key }, 'cache HIT')
        return emCache
      }

      log.debug({ key }, 'cache MISS')
      const valor = await fetchFn()
      await this.set(key, valor, ttlSegundos)
      return valor
    },
  }
}

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
redis.on('error', (erro: Error) => {
  logger.error({ err: erro }, 'Erro de conexão com o Redis')
})

/** Instância padrão de cache usada pelos services. */
export const cache: Cache = criarCache(redis)
