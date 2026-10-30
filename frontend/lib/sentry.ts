/**
 * Decide se um erro não deve ser enviado ao Sentry: limite de requisições (429)
 * e cancelamentos de requisição, que são esperados.
 * Os serviços de fetch lançam erros com "(HTTP 429)" na mensagem.
 * @param erro Erro capturado (qualquer tipo).
 * @returns true se o erro deve ser ignorado.
 */
export function deveIgnorarErro(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false
  if ('name' in erro && erro.name === 'AbortError') return true
  if ('message' in erro && typeof erro.message === 'string') {
    return erro.message.includes('(HTTP 429)') || erro.message.includes('Too Many Requests')
  }
  return false
}
