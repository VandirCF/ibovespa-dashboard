/**
 * Formatadores pt-BR do IBovespa Dashboard.
 * Todo valor monetário, percentual e data exibido no app deve passar por aqui.
 */

const FORMATO_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const FORMATO_VARIACAO = new Intl.NumberFormat('pt-BR', {
  signDisplay: 'exceptZero',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formata um valor em reais.
 * @param valor Valor numérico em reais.
 * @returns Texto no formato "R$ 45,23".
 */
export function formatarMoeda(valor: number): string {
  return FORMATO_MOEDA.format(valor)
}

/**
 * Formata uma variação percentual com sinal explícito.
 * @param percentual Variação em pontos percentuais (ex.: 2.45 para +2,45%).
 * @returns Texto no formato "+2,45%" ou "-1,30%".
 */
export function formatarVariacao(percentual: number): string {
  return `${FORMATO_VARIACAO.format(percentual)}%`
}

/**
 * Formata uma data ISO (YYYY-MM-DD) ou um objeto Date no padrão brasileiro.
 * Strings ISO são tratadas como data civil, sem deslocamento de fuso horário.
 * @param data Data no formato 'YYYY-MM-DD' ou instância de Date.
 * @returns Texto no formato "09/04/2026".
 */
export function formatarData(data: string | Date): string {
  if (typeof data === 'string') {
    const [ano, mes, dia] = data.slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
  }
  return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const FORMATO_VOLUME = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

/**
 * Formata um volume de negociação de forma compacta.
 * @param volume Quantidade de ações negociadas.
 * @returns Texto compacto em pt-BR, ex.: "51,97 mi".
 */
export function formatarVolume(volume: number): string {
  return FORMATO_VOLUME.format(volume)
}

/**
 * Formata um valor de mercado em reais com sufixo de escala (bi / tri).
 * @param valor Valor de mercado em reais.
 * @returns Texto em pt-BR, ex.: "R$ 716,79 bi".
 */
export function formatarValorDeMercado(valor: number): string {
  return `R$ ${new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 }).format(valor)}`
}

/**
 * Formata a hora (HH:MM:SS) no fuso de Brasília.
 * @param data Instante a ser formatado.
 * @returns Texto no formato "14:05:09".
 */
export function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Formata data e hora no fuso de Brasília.
 * @param data Instante a ser formatado.
 * @returns Texto no formato "09/04/2026 14:05".
 */
export function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formata data curta (dd/mm/aa) no fuso de Brasília, para eixos e intervalos de datas.
 * @param data Instante ou data ISO.
 * @returns Texto no formato "30/10/26".
 */
export function formatarDataCurta(data: Date | string): string {
  const instante = typeof data === 'string' ? new Date(data) : data
  return instante.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

/**
 * Formata data e hora curtas (dd/mm/aa HH:mm), sem vírgula, no fuso de Brasília.
 * @param data Instante a ser formatado.
 * @returns Texto no formato "30/10/26 11:50".
 */
export function formatarDataHoraCurta(data: Date): string {
  const hora = data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatarDataCurta(data)} ${hora}`
}

const FORMATO_NUMERO_UMA_CASA = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formata um número com uma casa decimal, sem sinal nem unidade.
 * @param valor Número a formatar.
 * @returns Texto em pt-BR, ex.: "8,5".
 */
export function formatarNumero(valor: number): string {
  return FORMATO_NUMERO_UMA_CASA.format(valor)
}

/**
 * Formata um percentual com uma casa decimal, sem sinal.
 * @param valor Percentual em pontos (12.3 para 12,3%).
 * @returns Texto em pt-BR, ex.: "12,3%".
 */
export function formatarPercentual(valor: number): string {
  return `${FORMATO_NUMERO_UMA_CASA.format(valor)}%`
}

const FORMATO_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/**
 * Formata um número inteiro com separador de milhar.
 * @param valor Número a formatar (arredondado).
 * @returns Texto em pt-BR, ex.: "1.234".
 */
export function formatarInteiro(valor: number): string {
  return FORMATO_INTEIRO.format(valor)
}

/**
 * Indica se um instante cai em outro dia civil de Brasília em relação a agora (ex.: fechamento de ontem).
 * @param instante Momento da leitura da cotação.
 * @param agora Referência (padrão: agora).
 * @returns true se o dia civil de Brasília for diferente.
 */
export function ehDeOutroDia(instante: Date, agora: Date = new Date()): boolean {
  const diaDe = (data: Date): string =>
    data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return diaDe(instante) !== diaDe(agora)
}

/**
 * Formata somente a hora (HH:mm) no fuso de Brasília, para o eixo de períodos intradiários.
 * @param data Instante a ser formatado.
 * @returns Texto no formato "11:50".
 */
export function formatarHoraCurta(data: Date): string {
  return data.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}
