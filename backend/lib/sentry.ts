import * as Sentry from '@sentry/node'
import { env } from './env'

/**
 * Decide se um erro não deve ser enviado ao Sentry: limite de requisições (429)
 * e cancelamentos de requisição. Esses erros são esperados e poluiriam o painel.
 * @param erro Erro capturado (qualquer tipo).
 * @returns true se o erro deve ser ignorado.
 */
export function deveIgnorarErro(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false
  if ('name' in erro && erro.name === 'AbortError') return true
  if ('code' in erro && erro.code === 'ERR_CANCELED') return true
  if ('statusCode' in erro && erro.statusCode === 429) return true
  if ('response' in erro && typeof erro.response === 'object' && erro.response !== null) {
    if ('status' in erro.response && erro.response.status === 429) return true
  }
  if ('message' in erro && typeof erro.message === 'string') {
    return erro.message.includes('Too Many Requests')
  }
  return false
}

/**
 * Inicializa o Sentry somente se `SENTRY_DSN` estiver definida. Sem DSN, nada é enviado.
 * @returns void
 */
export function iniciarSentry(): void {
  if (!env.SENTRY_DSN) return
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.SENTRY_RELEASE,
    tracesSampleRate: 0,
    beforeSend(evento, dica) {
      return deveIgnorarErro(dica.originalException) ? null : evento
    },
  })
}

export { Sentry }
