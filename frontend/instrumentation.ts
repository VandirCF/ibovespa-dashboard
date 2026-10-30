/**
 * Hook de inicialização do Next.js: carrega a configuração do Sentry no servidor (Node.js).
 * @returns Promise resolvida após o carregamento.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
}
