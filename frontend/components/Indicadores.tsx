'use client'

import useSWR from 'swr'
import type { Indicadores as IndicadoresAtivo } from '@/types'
import { buscarIndicadores } from '@/services/indicadoresService'
import {
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarValorDeMercado,
} from '@/lib/formatters'

/** Definição de um card: rótulo com a abreviatura por extenso, explicação (tooltip) e formatação. */
interface DefinicaoIndicador {
  campo: Exclude<keyof IndicadoresAtivo, 'ticker'>
  rotulo: string
  descricao: string
  formatar: (valor: number) => string
}

/** Grupo de indicadores exibido como seção do painel. */
interface GrupoIndicadores {
  titulo: string
  indicadores: DefinicaoIndicador[]
}

/** Formata um múltiplo em vezes (ex.: "3,2x"). */
const formatarVezes = (valor: number): string => `${formatarNumero(valor)}x`

/** Indicadores agrupados por tipo de análise fundamentalista. */
const GRUPOS: GrupoIndicadores[] = [
  {
    titulo: 'Valuation',
    indicadores: [
      {
        campo: 'marketCap',
        rotulo: 'Valor de mercado',
        descricao: 'Valor total da empresa na bolsa: preço de todas as ações em circulação.',
        formatar: formatarValorDeMercado,
      },
      {
        campo: 'pl',
        rotulo: 'P/L (Preço/Lucro)',
        descricao:
          'Preço da ação dividido pelo lucro por ação. Mostra quantos anos de lucro atual estão no preço.',
        formatar: formatarNumero,
      },
      {
        campo: 'pvp',
        rotulo: 'P/VP (Preço/Valor Patrimonial)',
        descricao:
          'Preço da ação dividido pelo valor patrimonial por ação. Abaixo de 1 indica preço menor que o patrimônio contábil.',
        formatar: formatarNumero,
      },
      {
        campo: 'evEbitda',
        rotulo: 'EV/EBITDA (Valor da Firma/EBITDA)',
        descricao:
          'Valor da firma (valor de mercado mais dívida líquida) dividido pelo EBITDA. Compara o preço da empresa inteira com a geração operacional de caixa.',
        formatar: formatarVezes,
      },
      {
        campo: 'evReceita',
        rotulo: 'EV/Receita (Valor da Firma/Receita)',
        descricao: 'Valor da firma dividido pela receita dos últimos 12 meses.',
        formatar: formatarVezes,
      },
      {
        campo: 'peg',
        rotulo: 'PEG (P/L/Crescimento do Lucro)',
        descricao:
          'P/L dividido pelo crescimento esperado do lucro. Valores abaixo de 1 sugerem preço razoável em relação ao crescimento.',
        formatar: formatarNumero,
      },
      {
        campo: 'dividendYield',
        rotulo: 'Dividend Yield (Dividendos/Preço)',
        descricao:
          'Proventos pagos nos últimos 12 meses divididos pelo preço atual, em percentual.',
        formatar: formatarPercentual,
      },
      {
        campo: 'fcfYield',
        rotulo: 'FCF Yield (Fluxo de Caixa Livre/Valor de Mercado)',
        descricao:
          'Fluxo de caixa livre dividido pelo valor de mercado. Mostra quanto de caixa a empresa gera em relação ao preço pago.',
        formatar: formatarPercentual,
      },
    ],
  },
  {
    titulo: 'Rentabilidade',
    indicadores: [
      {
        campo: 'roe',
        rotulo: 'ROE (Retorno sobre o Patrimônio)',
        descricao:
          'Lucro dividido pelo patrimônio líquido, em percentual. Mede quanto a empresa rende sobre o capital dos acionistas.',
        formatar: formatarPercentual,
      },
      {
        campo: 'roa',
        rotulo: 'ROA (Retorno sobre os Ativos)',
        descricao:
          'Lucro dividido pelo total de ativos, em percentual. Mede a eficiência no uso dos ativos.',
        formatar: formatarPercentual,
      },
      {
        campo: 'margemBruta',
        rotulo: 'Margem bruta',
        descricao:
          'Lucro bruto dividido pela receita, em percentual. Mostra o poder de precificação do produto.',
        formatar: formatarPercentual,
      },
      {
        campo: 'margemEbitda',
        rotulo: 'Margem EBITDA (EBITDA/Receita)',
        descricao:
          'EBITDA dividido pela receita, em percentual. Mostra a geração operacional de caixa por real vendido.',
        formatar: formatarPercentual,
      },
      {
        campo: 'margemOperacional',
        rotulo: 'Margem operacional',
        descricao: 'Lucro operacional (EBIT) dividido pela receita, em percentual.',
        formatar: formatarPercentual,
      },
      {
        campo: 'margemLiquida',
        rotulo: 'Margem líquida',
        descricao:
          'Lucro líquido dividido pela receita, em percentual. Mostra quanto da receita vira lucro.',
        formatar: formatarPercentual,
      },
    ],
  },
  {
    titulo: 'Endividamento e liquidez',
    indicadores: [
      {
        campo: 'dividaLiquidaEbitda',
        rotulo: 'Dívida líquida/EBITDA',
        descricao:
          'Dívida líquida (dívida total menos caixa) dividida pelo EBITDA. Quantos anos de geração operacional seriam necessários para pagar a dívida. Acima de 3x costuma ser motivo de atenção.',
        formatar: formatarVezes,
      },
      {
        campo: 'dividaLiquidaPl',
        rotulo: 'Dívida líquida/Patrimônio líquido',
        descricao:
          'Dívida líquida dividida pelo patrimônio líquido. Mede o grau de alavancagem financeira da empresa.',
        formatar: formatarVezes,
      },
      {
        campo: 'liquidezCorrente',
        rotulo: 'Liquidez corrente',
        descricao:
          'Ativo circulante dividido pelo passivo circulante. Acima de 1 indica capacidade de pagar as obrigações de curto prazo.',
        formatar: formatarVezes,
      },
      {
        campo: 'liquidezSeca',
        rotulo: 'Liquidez seca',
        descricao:
          'Liquidez corrente sem estoques. Mostra a capacidade de pagamento de curto prazo sem depender da venda de estoques.',
        formatar: formatarVezes,
      },
    ],
  },
  {
    titulo: 'Crescimento e por ação',
    indicadores: [
      {
        campo: 'crescimentoReceita',
        rotulo: 'Crescimento da receita (12 meses)',
        descricao: 'Variação da receita nos últimos 12 meses, em percentual.',
        formatar: formatarPercentual,
      },
      {
        campo: 'crescimentoLucro',
        rotulo: 'Crescimento do lucro (12 meses)',
        descricao: 'Variação do lucro nos últimos 12 meses, em percentual.',
        formatar: formatarPercentual,
      },
      {
        campo: 'lpa',
        rotulo: 'LPA (Lucro por Ação)',
        descricao: 'Lucro líquido dividido pelo número de ações, em reais.',
        formatar: formatarMoeda,
      },
      {
        campo: 'vpa',
        rotulo: 'VPA (Valor Patrimonial por Ação)',
        descricao: 'Patrimônio líquido dividido pelo número de ações, em reais.',
        formatar: formatarMoeda,
      },
      {
        campo: 'beta',
        rotulo: 'Beta',
        descricao:
          'Sensibilidade do preço da ação às variações do mercado. Acima de 1 indica ação mais volátil que o mercado.',
        formatar: formatarNumero,
      },
    ],
  },
]

interface PropsIndicadores {
  /** Ticker do ativo, ex.: PETR4. */
  ticker: string
}

/**
 * Painel de indicadores fundamentalistas, agrupado por tipo de análise.
 * Cada card tem tooltip com a explicação. Campos sem dado aparecem como "—".
 * Os dados vêm do backend, que cacheia por 24 horas.
 * @param props.ticker Ticker do ativo.
 * @returns Seções de indicadores com estados de carregamento e erro.
 */
export default function Indicadores({ ticker }: PropsIndicadores) {
  const { data, error, isLoading, mutate } = useSWR(`indicadores:${ticker}`, () =>
    buscarIndicadores(ticker),
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
        <p className="text-slate-300">Não foi possível carregar os indicadores agora.</p>
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
      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} aria-labelledby={`grupo-${grupo.titulo}`}>
          <h3
            id={`grupo-${grupo.titulo}`}
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
