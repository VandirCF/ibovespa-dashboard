import type { FastifyInstance } from 'fastify'

/**
 * Rotas de recomendações IA (`/api/ativos/:ticker/analise`). Endpoints adicionados na T-014.
 * @param app Instância do Fastify.
 */
export async function recomendacoesRoutes(app: FastifyInstance): Promise<void> {
  app.log.debug('Rotas de recomendações registradas (endpoints pendentes: T-014)')
}
