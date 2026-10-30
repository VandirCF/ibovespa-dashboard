import * as Sentry from '@sentry/nextjs'
import { deveIgnorarErro } from './lib/sentry'

/** DSN do servidor do Next (variável privada). Sem DSN, o Sentry fica desligado. */
const DSN = process.env.SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0,
    beforeSend(evento, dica) {
      return deveIgnorarErro(dica.originalException) ? null : evento
    },
  })
}
