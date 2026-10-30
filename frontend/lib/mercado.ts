/** Início pregão B3 em horário de Brasília (PRD 3.1: 10h–18h, dias úteis). */
const HORA_ABERTURA = 10

/** Fim do horário de referência do app em Brasília (PRD 3.1). */
const HORA_FECHAMENTO = 18

/**
 * Indica se o mercado está no horário de referência do app (dias úteis, 10h–18h de Brasília).
 * Não considera feriados; é uma indicação visual, não um status oficial da B3.
 * @param instante Momento a ser avaliado (padrão: agora).
 * @returns true se estiver no horário de pregão de referência.
 */
export function estaAbertoB3(instante: Date = new Date()): boolean {
  // Converte o instante para o relógio de parede de Brasília; getDay/getHours passam a refletir esse horário.
  const brasilia = new Date(instante.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const diaUtil = brasilia.getDay() >= 1 && brasilia.getDay() <= 5
  const hora = brasilia.getHours()
  return diaUtil && hora >= HORA_ABERTURA && hora < HORA_FECHAMENTO
}
