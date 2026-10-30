/**
 * Tipos compartilhados entre frontend e backend.
 */

/** Cotação atual de um ativo do IBovespa. */
export interface AtivoPreco {
  /** Ticker sem sufixo, ex.: PETR4. */
  ticker: string
  /** Nome da empresa ou do papel. */
  nome: string
  /** Preço atual em reais. */
  preco: number
  /** Variação do dia em reais. */
  variacao: number
  /** Variação do dia em percentual (2.45 = +2,45%). */
  variacaoPercent: number
  /** Volume negociado no dia. */
  volume: number
  /** Valor de mercado em reais, quando disponível. */
  marketCap: number | null
  /** Setor em pt-BR (vem do cadastro local de ativos). */
  setor?: string
}

/** Período suportado pelo gráfico de candlestick. */
export type Periodo = '1d' | '1w' | '1m' | '3m' | '1y' | '5y'

/** Candle OHLCV. */
export interface Candle {
  /** Data/hora do candle em ISO 8601. */
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}
