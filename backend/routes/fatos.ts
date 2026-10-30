import type { FastifyInstance } from 'fastify'

/**
 * Rotas de fatos relevantes (`/api/ativos/:ticker/fatos`). Endpoints adicionados na T-012.
 * @param app Instância do Fastify.
 */
export async function fatosRoutes(app: FastifyInstance): Promise<void> {
  app.log.debug('Rotas de fatos relevantes registradas (endpoints pendentes: T-012)')
}
