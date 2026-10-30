'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type UTCTimestamp,
} from 'lightweight-charts'
import useSWR from 'swr'
import type { Candle, Periodo } from '@/types'
import { buscarHistorico } from '@/services/historicoService'
import {
  formatarData,
  formatarDataHora,
  formatarHora,
  formatarMoeda,
  formatarVolume,
} from '@/lib/formatters'

/** Cores da paleta do projeto (tailwind.config.ts). */
const COR_ALTA = '#16A34A'
const COR_BAIXA = '#DC2626'
const COR_MEDIA_20 = '#FACC15'
const COR_MEDIA_50 = '#60A5FA'
const COR_GRADE = '#1e293b'
const COR_BORDA = '#334155'
const COR_TEXTO = '#94a3b8'

/** Proporção do painel de preço e do painel de volume (o volume ocupa o restante). */
const FRACAO_PRECO = 0.72

/** Períodos exibidos no seletor (rótulo → valor da API). */
const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: '1d', rotulo: '1D' },
  { valor: '1w', rotulo: '1S' },
  { valor: '1m', rotulo: '1M' },
  { valor: '3m', rotulo: '3M' },
  { valor: '1y', rotulo: '1A' },
  { valor: '5y', rotulo: '5A' },
]

/** Períodos com candles intradiários: o tooltip mostra também a hora. */
const PERIODOS_INTRADIARIOS: Periodo[] = ['1d', '1w']

interface PropsGrafico {
  ticker: string
}

/** Estrutura do tooltip exibido ao passar o mouse. */
interface DadosTooltip {
  candle: Candle
  x: number
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
 * Opções comuns a todos os painéis do gráfico (cores, grade e fonte).
 * @returns Opções para `createChart`, sem dimensões.
 */
function opcoesBase() {
  return {
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: COR_TEXTO },
    grid: { vertLines: { color: COR_GRADE }, horzLines: { color: COR_GRADE } },
    crosshair: { mode: CrosshairMode.Normal },
  }
}

/**
 * Gráfico de candlestick com painel de volume abaixo, seletor de período, médias móveis e tooltip.
 * Preço e volume são dois gráficos sincronizados no mesmo intervalo de tempo.
 * Ao trocar o período, o gráfico anterior fica visível até os novos dados chegarem.
 * @param props.ticker Ticker do ativo, ex.: "PETR4".
 * @returns Gráfico interativo ou estado de carregamento/erro.
 */
export default function GraficoCandlestick({ ticker }: PropsGrafico) {
  const [periodo, setPeriodo] = useState<Periodo>('1d')
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

  const { data, error, isLoading, mutate } = useSWR<Candle[]>(
    ['historico', ticker, periodo],
    () => buscarHistorico(ticker, periodo),
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  // Índice tempo → candle, usado pelo tooltip.
  const porTempo = useMemo(() => {
    const mapa = new Map<number, Candle>()
    for (const c of data ?? []) mapa.set(paraSegundos(c.timestamp), c)
    return mapa
  }, [data])

  // Referência atual do índice para o handler do crosshair (registrado uma única vez).
  const porTempoRef = useRef(porTempo)
  useEffect(() => {
    porTempoRef.current = porTempo
  }, [porTempo])

  // Cria os dois gráficos uma vez, sincroniza o tempo e os destrói ao desmontar.
  useEffect(() => {
    const precoEl = precoRef.current
    const volumeEl = volumeRef.current
    if (!precoEl || !volumeEl) return

    const preco = createChart(precoEl, {
      ...opcoesBase(),
      width: precoEl.clientWidth,
      height: precoEl.clientHeight,
      rightPriceScale: { borderColor: COR_BORDA, scaleMargins: { top: 0.06, bottom: 0.04 } },
      timeScale: { visible: false, borderColor: COR_BORDA },
    })

    const volume = createChart(volumeEl, {
      ...opcoesBase(),
      width: volumeEl.clientWidth,
      height: volumeEl.clientHeight,
      rightPriceScale: {
        visible: false,
        borderColor: COR_BORDA,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: { borderColor: COR_BORDA, timeVisible: true },
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

    const wrapper = wrapperRef.current
    const observador = new ResizeObserver(() => {
      preco.resize(precoEl.clientWidth, precoEl.clientHeight)
      volume.resize(volumeEl.clientWidth, volumeEl.clientHeight)
      // Ao mudar a largura, reajusta para caber todo o período (senão mostra só o final).
      preco.timeScale().fitContent()
    })
    if (wrapper) observador.observe(wrapper)

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

  // Envia candles e volume para as séries sempre que chegam dados novos.
  useEffect(() => {
    if (!data || !candleRef.current || !volumeSerieRef.current) return
    candleRef.current.setData(
      data.map((c) => ({
        time: paraSegundos(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })) as CandlestickData<UTCTimestamp>[],
    )
    volumeSerieRef.current.setData(
      data.map((c) => ({
        time: paraSegundos(c.timestamp),
        value: c.volume,
        color: c.close >= c.open ? `${COR_ALTA}99` : `${COR_BAIXA}99`,
      })) as HistogramData<UTCTimestamp>[],
    )
    graficoPrecoRef.current?.timeScale().fitContent()
    graficoVolumeRef.current?.timeScale().fitContent()
  }, [data])

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
      if (ativa && ref.current && data) {
        ref.current.setData(mediaMovel(data, janela))
      }
    }
    sincronizar(mostrarMM20, mm20Ref, 20, COR_MEDIA_20)
    sincronizar(mostrarMM50, mm50Ref, 50, COR_MEDIA_50)
  }, [data, mostrarMM20, mostrarMM50])

  const intradiario = PERIODOS_INTRADIARIOS.includes(periodo)
  const semDados = data !== undefined && data.length === 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Período do gráfico"
          className="inline-flex rounded-md border border-slate-700 p-0.5"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={p.valor === periodo}
              onClick={() => setPeriodo(p.valor)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                p.valor === periodo
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>

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
        className="relative flex h-[340px] w-full flex-col sm:h-[480px] lg:h-[calc(100vh-380px)] lg:min-h-[440px]"
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

      {data && data.length > 0 && (
        <p className="text-xs text-slate-500">
          Atualizado às {formatarHora(new Date())} · {data.length} candles
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
