import * as Sentry from '@sentry/nextjs'
import { deveIgnorarErro } from './sentry'

/**
 * Inicializa o Sentry no navegador. Chamado somente quando `NEXT_PUBLIC_SENTRY_DSN` existe,
 * por import dinâmico, para que o SDK não entre no bundle inicial sem DSN.
 * @returns void
 */
export function iniciarSentryCliente(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0,
    beforeSend(evento, dica) {
      return deveIgnorarErro(dica.originalException) ? null : evento
    },
  })
}
