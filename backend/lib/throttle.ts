/** Intervalo mínimo entre requisições a sites que fazem scraping, em milissegundos (CLAUDE.md). */
export const DELAY_SCRAPING_MS = 1000

/** Cadeia que serializa as requisições de scraping e impõe o intervalo entre elas. */
let filaScraping: Promise<unknown> = Promise.resolve()

/**
 * Executa a tarefa somente após a anterior e após o intervalo mínimo entre requisições.
 * Erros da tarefa são propagados ao chamador; a fila segue funcionando.
 * @param tarefa Função assíncrona que faz uma requisição de scraping.
 * @returns Resultado da tarefa.
 */
export function executarComDelay<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaScraping.then(tarefa)
  filaScraping = resultado
    .catch(() => undefined)
    .then(() => new Promise<void>((resolver) => setTimeout(resolver, DELAY_SCRAPING_MS)))
  return resultado
}
