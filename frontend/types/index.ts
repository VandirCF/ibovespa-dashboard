/**
 * Tipos compartilhados entre frontend e backend.
 */

/** Tipo de ativo exibido no app: ação do IBovespa ou fundo imobiliário. */
export type TipoAtivo = 'acao' | 'fii'

/** Cotação atual de um ativo (ação ou fundo imobiliário). */
export interface AtivoPreco {
  /** Ticker sem sufixo, ex.: PETR4. */
  ticker: string
  /** Nome da empresa ou do papel. */
  nome: string
  /** Preço atual em reais. */
  preco: number
  /** Variação do dia em reais. Null quando a fonte só traz o último fechamento. */
  variacao: number | null
  /** Variação do dia em percentual (2.45 = +2,45%). Null quando indisponível. */
  variacaoPercent: number | null
  /** Liquidez média diária em reais nos últimos 2 meses (Fundamentus). Null quando indisponível. */
  liquidez: number | null
  /** Tipo do ativo: ação ou fundo imobiliário. */
  tipo?: TipoAtivo
  /** Momento da leitura da cotação (ISO 8601). Usado para indicar fechamentos de pregões anteriores. */
  atualizadoEm?: string
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

/** Categorias de comunicados da B3 exibidas na tela de fatos relevantes. */
export const CATEGORIAS_FATO = [
  'Resultado',
  'Fato Relevante',
  'Aviso',
  'Assembleia',
  'Outros',
] as const

/** Categoria de um comunicado. */
export type CategoriaFato = (typeof CATEGORIAS_FATO)[number]

/** Comunicado publicado por uma empresa (fato relevante, resultado, aviso etc.). */
export interface Fato {
  /** Identificador do comunicado na fonte. */
  id: string
  /** Título do comunicado. */
  titulo: string
  /** Categoria mapeada a partir do título. */
  categoria: CategoriaFato
  /** Data de publicação no formato AAAA-MM-DD. */
  dataPublicacao: string
  /** Resumo do comunicado, quando disponível. */
  resumo: string | null
  /** Link do documento original. */
  urlOriginal: string
}

/** Indicadores fundamentalistas. Campos sem dado disponível são null. */
export interface Indicadores {
  ticker: string
  /** Valor de mercado em reais. */
  marketCap: number | null
  /** P/L (Preço/Lucro). */
  pl: number | null
  /** P/VP (Preço/Valor Patrimonial). */
  pvp: number | null
  /** EV/EBITDA (Valor da Firma / EBITDA). */
  evEbitda: number | null
  /** EV/Receita (Valor da Firma / Receita). */
  evReceita: number | null
  /** PEG (P/L dividido pelo crescimento do lucro). */
  peg: number | null
  /** Dividend Yield (Dividendos / Preço) em percentual (2.5 = 2,5%). */
  dividendYield: number | null
  /** FCF Yield (Fluxo de Caixa Livre / Valor de Mercado) em percentual. */
  fcfYield: number | null
  /** ROE (Retorno sobre o Patrimônio) em percentual. */
  roe: number | null
  /** ROA (Retorno sobre os Ativos) em percentual. */
  roa: number | null
  /** Margem bruta em percentual. */
  margemBruta: number | null
  /** Margem EBITDA (EBITDA / Receita) em percentual. */
  margemEbitda: number | null
  /** Margem operacional em percentual. */
  margemOperacional: number | null
  /** Margem líquida em percentual. */
  margemLiquida: number | null
  /** Dívida líquida / EBITDA, em vezes. */
  dividaLiquidaEbitda: number | null
  /** Dívida líquida / Patrimônio líquido, em vezes. */
  dividaLiquidaPl: number | null
  /** Liquidez corrente, em vezes. */
  liquidezCorrente: number | null
  /** Liquidez seca, em vezes. */
  liquidezSeca: number | null
  /** Crescimento da receita nos últimos 12 meses, em percentual. */
  crescimentoReceita: number | null
  /** Crescimento médio anual da receita nos últimos 5 anos, em percentual. */
  crescimentoReceita5a: number | null
  /** Crescimento do lucro nos últimos 12 meses, em percentual. */
  crescimentoLucro: number | null
  /** LPA (Lucro por Ação) em reais. */
  lpa: number | null
  /** VPA (Valor Patrimonial por Ação) em reais. */
  vpa: number | null
  /** Beta: sensibilidade do ativo ao mercado. */
  beta: number | null
}

/** Indicadores de um fundo imobiliário (Fundamentus). Campos sem dado disponível são null. */
export interface IndicadoresFii {
  ticker: string
  /** Segmento do fundo (ex.: Logística, Lajes Corporativas). */
  segmento: string | null
  /** Valor de mercado em reais. */
  valorMercado: number | null
  /** P/VP (Preço/Valor Patrimonial). */
  pvp: number | null
  /** Dividend Yield dos últimos 12 meses, em percentual. */
  dividendYield: number | null
  /** FFO Yield (Funds From Operations / Valor de mercado), em percentual. */
  ffoYield: number | null
  /** Cap Rate (receita de aluguel / valor dos imóveis), em percentual. */
  capRate: number | null
  /** Vacância média dos imóveis, em percentual. */
  vacancia: number | null
  /** Quantidade de imóveis do fundo. */
  qtdImoveis: number | null
  /** Preço do m² dos imóveis, em reais. */
  precoM2: number | null
  /** Aluguel por m², em reais. */
  aluguelM2: number | null
  /** Liquidez média diária em reais (últimos 2 meses). */
  liquidez: number | null
}
