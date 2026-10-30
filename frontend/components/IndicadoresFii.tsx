'use client'

import useSWR from 'swr'
import type { IndicadoresFii as IndicadoresDoFundo } from '@/types'
import { buscarIndicadoresFii } from '@/services/indicadoresFiiService'
import {
  formatarInteiro,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarValorDeMercado,
} from '@/lib/formatters'

/** Definição de um card: rótulo com a abreviatura por extenso, explicação (tooltip) e formatação. */
interface DefinicaoIndicadorFii {
  campo: Exclude<keyof IndicadoresDoFundo, 'ticker' | 'segmento'>
  rotulo: string
  descricao: string
  formatar: (valor: number) => string
}

/** Grupo de indicadores exibido como seção do painel. */
interface GrupoIndicadoresFii {
  titulo: string
  indicadores: DefinicaoIndicadorFii[]
}

/** Indicadores de fundos imobiliários, agrupados. */
const GRUPOS: GrupoIndicadoresFii[] = [
  {
    titulo: 'Valuation e rendimento',
    indicadores: [
      {
        campo: 'valorMercado',
        rotulo: 'Valor de mercado',
        descricao: 'Valor total do fundo na bolsa: preço da cota vezes o número de cotas.',
        formatar: formatarValorDeMercado,
      },
      {
        campo: 'pvp',
        rotulo: 'P/VP (Preço/Valor Patrimonial)',
        descricao:
          'Preço da cota dividido pelo valor patrimonial por cota. Abaixo de 1 indica cota negociada abaixo do patrimônio.',
        formatar: formatarNumero,
      },
      {
        campo: 'dividendYield',
        rotulo: 'Dividend Yield (Rendimentos/Preço)',
        descricao: 'Rendimentos distribuídos nos últimos 12 meses divididos pelo preço da cota.',
        formatar: formatarPercentual,
      },
      {
        campo: 'ffoYield',
        rotulo: 'FFO Yield (Funds From Operations/Valor de Mercado)',
        descricao:
          'Resultado operacional do fundo (FFO) dividido pelo valor de mercado. Mostra a geração de caixa recorrente.',
        formatar: formatarPercentual,
      },
    ],
  },
  {
    titulo: 'Imóveis',
    indicadores: [
      {
        campo: 'qtdImoveis',
        rotulo: 'Quantidade de imóveis',
        descricao: 'Número de imóveis do fundo. Fundos de papel (recebíveis) têm zero imóveis.',
        formatar: formatarInteiro,
      },
      {
        campo: 'capRate',
        rotulo: 'Cap Rate (Receita de Aluguel/Valor dos Imóveis)',
        descricao: 'Receita anual de aluguel dividida pelo valor dos imóveis, em percentual.',
        formatar: formatarPercentual,
      },
      {
        campo: 'vacancia',
        rotulo: 'Vacância média',
        descricao: 'Parcela média da área dos imóveis que está desocupada.',
        formatar: formatarPercentual,
      },
      {
        campo: 'precoM2',
        rotulo: 'Preço do m²',
        descricao: 'Valor dos imóveis dividido pela área total, em reais por metro quadrado.',
        formatar: formatarMoeda,
      },
      {
        campo: 'aluguelM2',
        rotulo: 'Aluguel por m²',
        descricao: 'Receita de aluguel por metro quadrado, em reais.',
        formatar: formatarMoeda,
      },
    ],
  },
  {
    titulo: 'Liquidez',
    indicadores: [
      {
        campo: 'liquidez',
        rotulo: 'Liquidez média diária',
        descricao: 'Volume financeiro médio negociado por dia nos últimos 2 meses.',
        formatar: formatarValorDeMercado,
      },
    ],
  },
]

interface PropsIndicadoresFii {
  /** Ticker do fundo, ex.: KNRI11. */
  ticker: string
}

/**
 * Painel de indicadores de fundo imobiliário, agrupado. Cada card tem tooltip com a explicação.
 * Campos sem dado aparecem como "—". Dados do Fundamentus (cache de 1 hora no backend).
 * @param props.ticker Ticker do fundo.
 * @returns Segmento e seções de indicadores, com estados de carregamento e erro.
 */
export default function IndicadoresFii({ ticker }: PropsIndicadoresFii) {
  const { data, error, isLoading, mutate } = useSWR(`indicadores-fii:${ticker}`, () =>
    buscarIndicadoresFii(ticker),
  )

  if (isLoading) {
    return (
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Carregando indicadores">
        {Array.from({ length: 8 }, (_, indice) => (
          <li
            key={indice}
            className="h-24 animate-pulse rounded-lg border border-slate-800 bg-slate-800/40"
          />
        ))}
      </ul>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-slate-800 p-6 text-center">
        <p className="text-slate-300">Não foi possível carregar os indicadores do fundo agora.</p>
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-400">
        Segmento: <span className="font-medium text-slate-100">{data.segmento ?? '—'}</span>
      </p>
      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} aria-labelledby={`grupo-fii-${grupo.titulo}`}>
          <h3
            id={`grupo-fii-${grupo.titulo}`}
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400"
          >
            {grupo.titulo}
          </h3>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {grupo.indicadores.map((definicao) => {
              const valor = data[definicao.campo]
              return (
                <li
                  key={definicao.campo}
                  title={definicao.descricao}
                  className="cursor-help rounded-lg border border-slate-800 p-4"
                >
                  <p className="text-xs text-slate-400">{definicao.rotulo}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
                    {valor === null ? '—' : definicao.formatar(valor)}
                  </p>
                  <p className="sr-only">{definicao.descricao}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
