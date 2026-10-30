import pino from 'pino'
import { env } from './env'

/**
 * Logger do backend para módulos fora das rotas do Fastify (cache, jobs, serviços).
 * Em desenvolvimento o nível é `debug`, o que habilita os logs de cache hit/miss.
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
})
