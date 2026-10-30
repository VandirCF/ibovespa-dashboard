import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

// Sem SENTRY_AUTH_TOKEN o plugin não envia source maps; o build continua normalmente.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
})
