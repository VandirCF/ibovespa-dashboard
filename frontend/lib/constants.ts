/**
 * Constantes globais do frontend.
 * TTLs de cache do backend ficam em server/lib/cache.ts; manter as duas listas alinhadas com o CLAUDE.md.
 */

/** Intervalo de revalidação da lista de ativos, em segundos. */
export const LISTA_REVALIDATE_SEGUNDOS = 300

/** Intervalo de atualização client-side (SWR) da lista de ativos, em milissegundos. */
export const LISTA_REFRESH_MS = 300_000

/** Número máximo de resultados exibidos no autocomplete de busca. */
export const BUSCA_MAX_RESULTADOS = 8

/** Quantidade de buscas recentes salvas no localStorage. */
export const BUSCA_HISTORICO_MAX = 5

/** Debounce do campo de busca, em milissegundos. */
export const BUSCA_DEBOUNCE_MS = 200
