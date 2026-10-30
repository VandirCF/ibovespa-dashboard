import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './lib/env'
import { ativosRoutes } from './routes/ativos'
import { graficosRoutes } from './routes/graficos'
import { fatosRoutes } from './routes/fatos'
import { indicadoresRoutes } from './routes/indicadores'
import { adminRoutes } from './routes/admin'
import { iniciarColeta } from './jobs/coletaHistorico'
import { Sentry, deveIgnorarErro, iniciarSentry } from './lib/sentry'

/** Limite de requisições por IP na API pública (PRD 4.3). */
const RATE_LIMIT_MAX = 60

/**
 * Cria e configura a instância do Fastify: CORS, rate limit e rotas por domínio.
 * @returns Instância do Fastify pronta para receber `listen`.
 */
export async function criarServidor(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  })

  app.setErrorHandler((erro, _req, reply) => {
    const status = erro.statusCode ?? 500
    if (status >= 500 && !deveIgnorarErro(erro)) {
      Sentry.captureException(erro)
    }
    return reply
      .status(status)
      .send({ erro: status >= 500 ? 'Erro interno do servidor.' : erro.message })
  })

  app.get('/health', async (): Promise<{ status: 'ok'; timestamp: string }> => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  await app.register(ativosRoutes, { prefix: '/api' })
  await app.register(graficosRoutes, { prefix: '/api' })
  await app.register(fatosRoutes, { prefix: '/api' })
  await app.register(indicadoresRoutes, { prefix: '/api' })

  await app.register(adminRoutes)

  return app
}

/**
 * Ponto de entrada do backend. Sobe o servidor HTTP na porta configurada (padrão 3001).
 * @returns Promise que resolve quando o servidor estiver escutando.
 */
async function main(): Promise<void> {
  iniciarSentry()
  const app = await criarServidor()
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  await iniciarColeta()
}

if (require.main === module) {
  main().catch((erro: unknown) => {
    console.error('Falha ao iniciar o servidor', erro)
    process.exit(1)
  })
}
