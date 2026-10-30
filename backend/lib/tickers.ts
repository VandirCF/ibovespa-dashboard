/** Padrão de ticker B3: 4 letras + número (ex.: PETR4, ENGI11, KNRI11). */
export const TICKER_REGEX = /^[A-Z]{4}\d{1,2}$/

/**
 * Normaliza um ticker: maiúsculas, sem espaços e sem sufixo `.SA`.
 * @param entrada Ticker informado pelo usuário ou pela API, ex.: "petr4" ou "PETR4.SA".
 * @returns Ticker normalizado, ex.: "PETR4".
 */
export function normalizarTicker(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\.SA$/, '')
}

/**
 * Converte um ticker para o símbolo usado pelo Yahoo Finance (sufixo `.SA`).
 * @param ticker Ticker de qualquer formato aceito por `normalizarTicker`.
 * @returns Símbolo Yahoo, ex.: "PETR4.SA".
 */
export function paraSimboloYahoo(ticker: string): string {
  return `${normalizarTicker(ticker)}.SA`
}
