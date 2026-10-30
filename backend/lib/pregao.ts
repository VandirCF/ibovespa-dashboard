/** Horário do pregão regular da B3 usado pelo app (Brasília): das 10h às 18h, de segunda a sexta. */
const HORA_ABERTURA = 10
const HORA_FECHAMENTO = 18

/**
 * Lê dia da semana, hora e data civil de um instante no fuso de Brasília.
 * @param instante Momento de referência.
 * @returns Dia útil, hora (0–23) e data no formato AAAA-MM-DD.
 */
function partesBrasilia(instante: Date): { diaUtil: boolean; hora: number; data: string } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const diaSemana = partes.find((parte) => parte.type === 'weekday')?.value ?? ''
  return {
    diaUtil: !['Sat', 'Sun'].includes(diaSemana),
    hora: Number(partes.find((parte) => parte.type === 'hour')?.value ?? '-1'),
    data: instante.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
  }
}

/**
 * Momento de encerramento do último pregão (18h de Brasília do último dia útil até agora).
 * Usado para datar leituras feitas fora do pregão, que mostram esse fechamento.
 * Feriados da B3 não são considerados.
 * @param agora Instante de referência (padrão: agora).
 * @returns Data do encerramento do último pregão.
 */
export function fimDoUltimoPregao(agora: Date = new Date()): Date {
  const UM_DIA_MS = 24 * 60 * 60 * 1000
  let dia = agora
  const hoje = partesBrasilia(dia)
  if (!(hoje.diaUtil && hoje.hora >= HORA_FECHAMENTO)) {
    do {
      dia = new Date(dia.getTime() - UM_DIA_MS)
    } while (!partesBrasilia(dia).diaUtil)
  }
  // Brasília não tem horário de verão desde 2019: UTC-3 fixo.
  return new Date(`${partesBrasilia(dia).data}T${HORA_FECHAMENTO}:00:00-03:00`)
}

/**
 * Indica se o instante está dentro do horário de pregão (segunda a sexta, 10h às 18h, Brasília).
 * Feriados da B3 não são considerados: nesses dias a função retorna true e as fontes trazem
 * o último fechamento.
 * @param agora Instante de referência (padrão: agora).
 * @returns true durante o pregão.
 */
export function emHorarioDePregao(agora: Date = new Date()): boolean {
  const { diaUtil, hora } = partesBrasilia(agora)
  return diaUtil && hora >= HORA_ABERTURA && hora < HORA_FECHAMENTO
}
