'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  TickMarkType,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import useSWR from 'swr'
import type { Candle, Periodo } from '@/types'
import { buscarHistorico } from '@/services/historicoService'
import { useTema, type Tema } from './ProvedorTema'
import {
  formatarData,
  formatarDataCurta,
  formatarDataHora,
  formatarDataHoraCurta,
  formatarHora,
  formatarHoraCurta,
  formatarMoeda,
  formatarVolume,
} from '@/lib/formatters'

/** Cores da paleta do projeto (tailwind.config.ts). */
const COR_ALTA = '#16A34A'
const COR_BAIXA = '#DC2626'
const COR_MEDIA_20 = '#FACC15'
const COR_MEDIA_50 = '#60A5FA'

/** Cores de grade, bordas e texto do gráfico, por tema. */
const CORES_TEMA: Record<Tema, { grade: string; borda: string; texto: string }> = {
  escuro: { grade: '#1e293b', borda: '#334155', texto: '#94a3b8' },
  claro: { grade: '#e2e8f0', borda: '#cbd5e1', texto: '#475569' },
}

/** Proporção do painel de preço (o volume ocupa o restante). */
const FRACAO_PRECO = 0.72

/** Abertura do pregão da B3 em horário de Brasília (início de cada dia no intradiário). */
const HORA_ABERTURA = '10:00:00'

/** Espaçamento dos candles intradiários em segundos (1D: 5 minutos; 1S: 1 hora). */
const PASSO_INTRADIARIO: Partial<Record<Periodo, number>> = { '1d': 300, '1w': 3600 }

/** Períodos exibidos no seletor (rótulo → valor da API). */
const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: '1d', rotulo: '1D' },
  { valor: '1w', rotulo: '1S' },
  { valor: '1m', rotulo: '1M' },
  { valor: '3m', rotulo: '3M' },
  { valor: '1y', rotulo: '1A' },
  { valor: '5y', rotulo: '5A' },
]

/** Períodos com candles intradiários: o eixo e o tooltip mostram também a hora. */
const PERIODOS_INTRADIARIOS: Periodo[] = ['1d', '1w']

interface PropsGrafico {
  ticker: string
}

/** Dados exibidos no tooltip ao passar o mouse. */
interface DadosTooltip {
  candle: Candle
  x: number
}

/** Intervalo de datas digitado pelo usuário (AAAA-MM-DD, horário de Brasília). */
interface IntervaloDatas {
  inicio: string
  fim: string
}

/** Séries prontas para o lightweight-charts, com os inícios de dia para o eixo. */
interface SeriesGrafico {
  candles: CandlestickData<UTCTimestamp>[]
  volumes: HistogramData<UTCTimestamp>[]
  inicios: Set<number>
}

/**
 * Converte um timestamp ISO em segundos UTC, formato esperado pelo lightweight-charts.
 * @param iso Data/hora ISO 8601 vinda da API.
 * @returns Segundos desde a época (UTC).
 */
function paraSegundos(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp
}

/**
 * Dia civil (AAAA-MM-DD) de um timestamp no fuso de Brasília.
 * @param iso Timestamp ISO do candle.
 * @returns Data no formato AAAA-MM-DD.
 */
function diaBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Instante (segundos UTC) da abertura do pregão do dia do timestamp informado.
 * @param iso Timestamp de qualquer candle daquele dia.
 * @returns Segundos UTC de 10:00 em Brasília (UTC-03:00, sem horário de verão desde 2019).
 */
function aberturaDoDia(iso: string): number {
  return Math.floor(new Date(`${diaBrasilia(iso)}T${HORA_ABERTURA}-03:00`).getTime() / 1000)
}

/**
 * Período da API que cobre a data inicial digitada, contando a partir de hoje (Brasília).
 * @param inicio Data inicial no formato AAAA-MM-DD.
 * @param hoje Data de hoje no formato AAAA-MM-DD.
 * @returns Período mais curto que contém a data inicial.
 */
function periodoParaInicio(inicio: string, hoje: string): Periodo {
  if (inicio >= hoje) return '1d'
  const dias = Math.round((Date.parse(hoje) - Date.parse(inicio)) / 864e5)
  if (dias <= 5) return '1w'
  if (dias <= 31) return '1m'
  if (dias <= 92) return '3m'
  if (dias <= 366) return '1y'
  return '5y'
}

/**
 * Monta as séries do gráfico. No intradiário, cada dia começa na abertura do pregão: se o primeiro
 * candle do dia vier depois, o intervalo até ele é preenchido com espaços vazios (whitespace).
 * @param data Candles ordenados do mais antigo para o mais recente.
 * @param intradiario Se o período é intradiário.
 * @param passo Espaçamento dos candles intradiários, em segundos.
 * @returns Séries de candles e volume e o conjunto de inícios de dia.
 */
function montarSeries(data: readonly Candle[], intradiario: boolean, passo: number): SeriesGrafico {
  const candles: CandlestickData<UTCTimestamp>[] = []
  const volumes: HistogramData<UTCTimestamp>[] = []
  const inicios = new Set<number>()
  let diaAnterior = ''

  for (const c of data) {
    const tempo = paraSegundos(c.timestamp)
    const dia = diaBrasilia(c.timestamp)
    if (intradiario && dia !== diaAnterior) {
      const abertura = aberturaDoDia(c.timestamp)
      inicios.add(abertura)
      for (let t = abertura; t < tempo; t += passo) {
        candles.push({ time: t as UTCTimestamp } as CandlestickData<UTCTimestamp>)
        volumes.push({ time: t as UTCTimestamp } as HistogramData<UTCTimestamp>)
      }
    }
    diaAnterior = dia

    candles.push({ time: tempo, open: c.open, high: c.high, low: c.low, close: c.close })
    volumes.push({
      time: tempo,
      value: c.volume,
      color: c.close >= c.open ? `${COR_ALTA}99` : `${COR_BAIXA}99`,
    })
  }
  return { candles, volumes, inicios }
}

/**
 * Média móvel simples sobre os fechamentos.
 * @param candles Candles ordenados por tempo.
 * @param janela Quantidade de períodos da média.
 * @returns Pontos da linha (começa quando há candles suficientes).
 */
function mediaMovel(candles: readonly Candle[], janela: number): LineData<UTCTimestamp>[] {
  const pontos: LineData<UTCTimestamp>[] = []
  let soma = 0
  for (let i = 0; i < candles.length; i++) {
    soma += candles[i].close
    if (i >= janela) soma -= candles[i - janela].close
    if (i >= janela - 1) {
      pontos.push({ time: paraSegundos(candles[i].timestamp), value: soma / janela })
    }
  }
  return pontos
}

/**
 * Aplica as cores do tema aos dois painéis do gráfico.
 * @param graficos Painel de preço e painel de volume.
 * @param tema Tema atual.
 */
function aplicarCores(graficos: IChartApi[], tema: Tema): void {
  const cores = CORES_TEMA[tema]
  for (const g of graficos) {
    g.applyOptions({
      layout: { textColor: cores.texto },
      grid: { vertLines: { color: cores.grade }, horzLines: { color: cores.grade } },
      rightPriceScale: { borderColor: cores.borda },
      timeScale: { borderColor: cores.borda },
    })
  }
}

/**
 * Gráfico de candlestick com painel de volume abaixo, seletor de período, intervalo de datas
 * digitado, médias móveis, tooltip e cores do tema claro/escuro.
 * No intradiário, cada dia começa na abertura do pregão (10:00) e a data aparece só no início do dia.
 * @param props.ticker Ticker do ativo, ex.: "PETR4".
 * @returns Gráfico interativo ou estado de carregamento/erro.
 */
export default function GraficoCandlestick({ ticker }: PropsGrafico) {
  const { tema } = useTema()
  const [periodoBotao, setPeriodoBotao] = useState<Periodo>('1d')
  // Intervalo digitado e aplicado (o gráfico só muda após Aplicar).
  const [aplicado, setAplicado] = useState<IntervaloDatas | null>(null)
  // Rascunho do que está nos campos De/Até; null = mostrar as datas automáticas.
  const [rascunho, setRascunho] = useState<IntervaloDatas | null>(null)
  const [mostrarMM20, setMostrarMM20] = useState(false)
  const [mostrarMM50, setMostrarMM50] = useState(false)
  const [tooltip, setTooltip] = useState<DadosTooltip | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const precoRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)

  const graficoPrecoRef = useRef<IChartApi | null>(null)
  const graficoVolumeRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSerieRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const mm20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const mm50Ref = useRef<ISeriesApi<'Line'> | null>(null)

  // Hoje em Brasília (AAAA-MM-DD), usado como limite das datas e para escolher o período da API.
  const hoje = diaBrasilia(new Date().toISOString())

  // Com intervalo aplicado, busca o período da API que cobre a data inicial; senão, usa o botão.
  const periodo: Periodo = aplicado ? periodoParaInicio(aplicado.inicio, hoje) : periodoBotao

  const { data, error, isLoading, mutate } = useSWR<Candle[]>(
    ['historico', ticker, periodo],
    () => buscarHistorico(ticker, periodo),
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  // Candles exibidos: todos, ou só os do intervalo aplicado (dias civis de Brasília).
  const dadosExibidos = useMemo<Candle[] | undefined>(() => {
    if (!data) return undefined
    if (!aplicado) return data
    return data.filter((c) => {
      const dia = diaBrasilia(c.timestamp)
      return dia >= aplicado.inicio && dia <= aplicado.fim
    })
  }, [data, aplicado])

  // Datas automáticas: primeiro e último dia do que está sendo exibido.
  const automatico: IntervaloDatas | null =
    dadosExibidos && dadosExibidos.length > 0
      ? {
          inicio: diaBrasilia(dadosExibidos[0].timestamp),
          fim: diaBrasilia(dadosExibidos[dadosExibidos.length - 1].timestamp),
        }
      : null

  // Valores nos campos: o rascunho, se existir; senão, as datas automáticas.
  const valorInicio = rascunho?.inicio ?? automatico?.inicio ?? ''
  const valorFim = rascunho?.fim ?? automatico?.fim ?? ''
  const datasInvalidas = Boolean(valorInicio && valorFim && valorInicio > valorFim)
  const podeAplicar = Boolean(rascunho && rascunho.inicio && rascunho.fim && !datasInvalidas)

  const intradiario = PERIODOS_INTRADIARIOS.includes(periodo)

  // Índice tempo → candle, usado pelo tooltip (só candles reais, sem espaços vazios).
  const porTempo = useMemo(() => {
    const mapa = new Map<number, Candle>()
    for (const c of dadosExibidos ?? []) mapa.set(paraSegundos(c.timestamp), c)
    return mapa
  }, [dadosExibidos])

  // Referências atuais usadas por handlers registrados uma única vez.
  const porTempoRef = useRef(porTempo)
  const intradiarioRef = useRef(intradiario)
  const temaRef = useRef(tema)
  const inicioDiaRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    porTempoRef.current = porTempo
  }, [porTempo])
  useEffect(() => {
    intradiarioRef.current = intradiario
  }, [intradiario])
  useEffect(() => {
    temaRef.current = tema
  }, [tema])

  // Cria os dois gráficos uma vez, sincroniza o tempo e os destrói ao desmontar.
  useEffect(() => {
    const precoEl = precoRef.current
    const volumeEl = volumeRef.current
    if (!precoEl || !volumeEl) return

    // Legenda do cursor: data completa. No intradiário, o eixo mostra só a hora.
    const formatarEixo = (tempo: Time): string => {
      const instante = new Date(Number(tempo) * 1000)
      return intradiarioRef.current ? formatarDataHoraCurta(instante) : formatarDataCurta(instante)
    }

    // Eixo: no intradiário, a data aparece só no início de cada dia; nos demais, só a hora.
    // Nos períodos diários, a data aparece sempre.
    const tiposData = new Set<TickMarkType>([
      TickMarkType.Year,
      TickMarkType.Month,
      TickMarkType.DayOfMonth,
    ])
    const formatarTick = (tempo: Time, tipo: TickMarkType): string => {
      const instante = new Date(Number(tempo) * 1000)
      if (!intradiarioRef.current) return formatarDataCurta(instante)
      if (inicioDiaRef.current.has(Number(tempo)) || tiposData.has(tipo))
        return formatarDataCurta(instante)
      return formatarHoraCurta(instante)
    }

    const cores = CORES_TEMA[temaRef.current]
    const opcoesComuns = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: cores.texto,
      },
      grid: { vertLines: { color: cores.grade }, horzLines: { color: cores.grade } },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { locale: 'pt-BR', timeFormatter: formatarEixo },
    }

    const preco = createChart(precoEl, {
      ...opcoesComuns,
      width: precoEl.clientWidth,
      height: precoEl.clientHeight,
      rightPriceScale: { borderColor: cores.borda, scaleMargins: { top: 0.06, bottom: 0.04 } },
      timeScale: { visible: false, borderColor: cores.borda },
    })

    const volume = createChart(volumeEl, {
      ...opcoesComuns,
      width: volumeEl.clientWidth,
      height: volumeEl.clientHeight,
      rightPriceScale: {
        visible: false,
        borderColor: cores.borda,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: {
        borderColor: cores.borda,
        timeVisible: true,
        tickMarkFormatter: (tempo: Time, tipo: TickMarkType) => formatarTick(tempo, tipo),
      },
    })

    candleRef.current = preco.addCandlestickSeries({
      upColor: COR_ALTA,
      downColor: COR_BAIXA,
      borderUpColor: COR_ALTA,
      borderDownColor: COR_BAIXA,
      wickUpColor: COR_ALTA,
      wickDownColor: COR_BAIXA,
    })

    volumeSerieRef.current = volume.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
    })

    // Mantém o mesmo intervalo de tempo nos dois painéis.
    let sincronizando = false
    const espelhar = (destino: IChartApi) => (intervalo: LogicalRange | null) => {
      if (sincronizando || !intervalo) return
      sincronizando = true
      destino.timeScale().setVisibleLogicalRange(intervalo)
      sincronizando = false
    }
    preco.timeScale().subscribeVisibleLogicalRangeChange(espelhar(volume))
    volume.timeScale().subscribeVisibleLogicalRangeChange(espelhar(preco))

    preco.subscribeCrosshairMove((param) => {
      const candle =
        param.time !== undefined ? porTempoRef.current.get(Number(param.time)) : undefined
      if (!candle || !param.point) {
        setTooltip(null)
        return
      }
      setTooltip({ candle, x: param.point.x })
    })

    graficoPrecoRef.current = preco
    graficoVolumeRef.current = volume

    const observador = new ResizeObserver(() => {
      preco.resize(precoEl.clientWidth, precoEl.clientHeight)
      volume.resize(volumeEl.clientWidth, volumeEl.clientHeight)
      // Ao mudar a largura, reajusta para caber todo o período (senão mostra só o final).
      preco.timeScale().fitContent()
    })
    if (wrapperRef.current) observador.observe(wrapperRef.current)

    return () => {
      observador.disconnect()
      preco.remove()
      volume.remove()
      graficoPrecoRef.current = null
      graficoVolumeRef.current = null
      candleRef.current = null
      volumeSerieRef.current = null
      mm20Ref.current = null
      mm50Ref.current = null
    }
  }, [])

  // Troca as cores do gráfico quando o tema muda.
  useEffect(() => {
    const preco = graficoPrecoRef.current
    const volume = graficoVolumeRef.current
    if (preco && volume) aplicarCores([preco, volume], tema)
  }, [tema])

  // Envia candles e volume para as séries sempre que os dados exibidos mudam.
  useEffect(() => {
    if (!dadosExibidos || !candleRef.current || !volumeSerieRef.current) return
    const series = montarSeries(dadosExibidos, intradiario, PASSO_INTRADIARIO[periodo] ?? 0)
    inicioDiaRef.current = series.inicios
    candleRef.current.setData(series.candles)
    volumeSerieRef.current.setData(series.volumes)

    // Ajusta a escala depois do desenho: com espaços vazios no início, o ajuste imediato
    // pode usar a largura antiga e deixar o começo do período fora da tela.
    const ajustar = (): void => {
      graficoPrecoRef.current?.timeScale().fitContent()
      graficoVolumeRef.current?.timeScale().fitContent()
    }
    ajustar()
    const id = window.setTimeout(ajustar, 50)
    return () => window.clearTimeout(id)
  }, [dadosExibidos, intradiario, periodo])

  // Liga e desliga as médias móveis como séries de linha no painel de preço.
  useEffect(() => {
    const preco = graficoPrecoRef.current
    if (!preco) return
    const sincronizar = (
      ativa: boolean,
      ref: { current: ISeriesApi<'Line'> | null },
      janela: number,
      cor: string,
    ): void => {
      if (ativa && !ref.current) {
        ref.current = preco.addLineSeries({
          color: cor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        })
      }
      if (!ativa && ref.current) {
        preco.removeSeries(ref.current)
        ref.current = null
      }
      if (ativa && ref.current && dadosExibidos) {
        ref.current.setData(mediaMovel(dadosExibidos, janela))
      }
    }
    sincronizar(mostrarMM20, mm20Ref, 20, COR_MEDIA_20)
    sincronizar(mostrarMM50, mm50Ref, 50, COR_MEDIA_50)
  }, [dadosExibidos, mostrarMM20, mostrarMM50])

  const semDados = dadosExibidos !== undefined && dadosExibidos.length === 0

  /**
   * Seleciona um período pelo botão: volta ao automático e descarta datas digitadas.
   * @param valor Período escolhido.
   */
  function escolherPeriodo(valor: Periodo): void {
    setPeriodoBotao(valor)
    setAplicado(null)
    setRascunho(null)
  }

  /**
   * Atualiza uma das datas do rascunho, mantendo a outra com o valor atual.
   * @param campo Qual data mudou.
   * @param valor Nova data (AAAA-MM-DD).
   */
  function alterarData(campo: 'inicio' | 'fim', valor: string): void {
    setRascunho({
      inicio: campo === 'inicio' ? valor : valorInicio,
      fim: campo === 'fim' ? valor : valorFim,
    })
  }

  /** Aplica o intervalo digitado: o gráfico se ajusta a ele. */
  function aplicar(): void {
    if (rascunho && podeAplicar) setAplicado(rascunho)
  }

  /** Limpa as datas digitadas e volta às datas automáticas do período escolhido. */
  function limpar(): void {
    setAplicado(null)
    setRascunho(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Seletor de período"
          className="flex flex-wrap items-center gap-2"
        >
          <div
            role="group"
            aria-label="Período do gráfico"
            className="inline-flex rounded-md border border-slate-700 p-0.5"
          >
            {PERIODOS.map((p) => {
              const selecionado = !aplicado && p.valor === periodoBotao
              return (
                <button
                  key={p.valor}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => escolherPeriodo(p.valor)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    selecionado
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {p.rotulo}
                </button>
              )
            })}
          </div>
          <label className="flex items-center gap-1 text-sm text-slate-400">
            De
            <input
              type="date"
              value={valorInicio}
              max={valorFim || hoje}
              onChange={(e) => alterarData('inicio', e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-400">
            Até
            <input
              type="date"
              value={valorFim}
              min={valorInicio || undefined}
              max={hoje}
              onChange={(e) => alterarData('fim', e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={aplicar}
            disabled={!podeAplicar}
            className="rounded-md bg-alta px-3 py-1 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={limpar}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:text-slate-100"
          >
            Limpar
          </button>
          {datasInvalidas && (
            <span className="text-sm text-baixa">A data inicial é posterior à final.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div role="group" aria-label="Médias móveis" className="inline-flex gap-2">
          <BotaoToggle
            ativo={mostrarMM20}
            cor={COR_MEDIA_20}
            onClick={() => setMostrarMM20((v) => !v)}
          >
            MA20
          </BotaoToggle>
          <BotaoToggle
            ativo={mostrarMM50}
            cor={COR_MEDIA_50}
            onClick={() => setMostrarMM50((v) => !v)}
          >
            MA50
          </BotaoToggle>
        </div>
      </div>

      <div
        ref={wrapperRef}
        role="region"
        aria-label={`Gráfico de candles de ${ticker}`}
        className="relative flex h-[340px] w-full flex-col sm:h-[480px] lg:h-[calc(100vh-440px)] lg:min-h-[400px]"
      >
        <div ref={precoRef} style={{ height: `${FRACAO_PRECO * 100}%` }} className="w-full" />
        <div
          ref={volumeRef}
          style={{ height: `${(1 - FRACAO_PRECO) * 100}%` }}
          className="w-full"
        />

        {tooltip && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-lg"
            style={{ left: Math.min(tooltip.x + 12, 220) }}
          >
            <p className="font-semibold">
              {intradiario
                ? formatarDataHora(new Date(tooltip.candle.timestamp))
                : formatarData(tooltip.candle.timestamp)}
            </p>
            <p className="tabular-nums">
              A {formatarMoeda(tooltip.candle.open)} · M {formatarMoeda(tooltip.candle.high)} · m{' '}
              {formatarMoeda(tooltip.candle.low)} · F {formatarMoeda(tooltip.candle.close)}
            </p>
            <p className="tabular-nums text-slate-400">
              Volume {formatarVolume(tooltip.candle.volume)}
            </p>
          </div>
        )}

        {isLoading && !data && (
          <div
            className="absolute inset-0 animate-pulse rounded-md bg-slate-800/60"
            role="status"
            aria-label="Carregando gráfico"
          />
        )}

        {error && !data && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-fundo/90 text-center">
            <p className="text-sm text-slate-300">Não foi possível carregar o gráfico agora.</p>
            <button
              type="button"
              onClick={() => void mutate()}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {semDados && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-fundo/90 text-sm text-slate-400">
            Sem dados para este período.
          </div>
        )}
      </div>

      {dadosExibidos && dadosExibidos.length > 0 && (
        <p className="text-xs text-slate-500">
          Atualizado às {formatarHora(new Date())} · {dadosExibidos.length} candles
        </p>
      )}
    </div>
  )
}

/**
 * Botão de liga/desliga de uma média móvel.
 * @param props.ativo Se a média está exibida.
 * @param props.cor Cor da linha, usada como indicador.
 * @param props.onClick Ação de alternar.
 * @param props.children Rótulo do botão.
 * @returns Botão com estado acessível.
 */
function BotaoToggle({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean
  cor: string
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        ativo
          ? 'border-slate-500 text-slate-100'
          : 'border-slate-700 text-slate-400 hover:text-slate-200'
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />
      {children}
    </button>
  )
}
