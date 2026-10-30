'use client'

import { useId, useState, type ChangeEvent } from 'react'
import useSWR from 'swr'
import { CATEGORIAS_FATO, type CategoriaFato, type Fato } from '@/types'
import { buscarFatos } from '@/services/fatosService'
import { formatarData } from '@/lib/formatters'

/** Quantidade de comunicados por página (e incremento do "Carregar mais"). */
const PASSO = 10

/** Limite máximo aceito pela API de fatos. */
const LIMITE_MAXIMO = 50

/** Períodos do filtro, em dias. */
const PERIODOS: { valor: number; rotulo: string }[] = [
  { valor: 30, rotulo: 'Últimos 30 dias' },
  { valor: 90, rotulo: 'Últimos 90 dias' },
  { valor: 180, rotulo: 'Últimos 180 dias' },
]

/** Classes do badge de categoria: cor por tipo de comunicado. */
const CLASSES_CATEGORIA: Record<CategoriaFato, string> = {
  Resultado: 'border-sky-500/40 bg-sky-500/15 text-sky-400',
  'Fato Relevante': 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  Aviso: 'border-violet-500/40 bg-violet-500/15 text-violet-400',
  Assembleia: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  Outros: 'border-slate-500/40 bg-slate-500/15 text-slate-400',
}

interface PropsFatosRelevantes {
  /** Ticker do ativo, ex.: PETR4. */
  ticker: string
}

/**
 * Lista de comunicados (fatos relevantes) de um ativo, com filtros de categoria e período.
 * Os filtros mudam a busca sem recarregar a página. A lista é paginada com "Carregar mais".
 * @param props.ticker Ticker do ativo exibido.
 * @returns Filtros, lista de cards e estados de carregamento, vazio e erro.
 */
export default function FatosRelevantes({ ticker }: PropsFatosRelevantes) {
  const [categoria, setCategoria] = useState<CategoriaFato | 'all'>('all')
  const [dias, setDias] = useState(90)
  const [limite, setLimite] = useState(PASSO)
  const base = useId()

  const { data, error, isLoading, mutate } = useSWR(
    `fatos:${ticker}:${categoria}:${dias}:${limite}`,
    () => buscarFatos(ticker, { categoria, dias, limite }),
    { keepPreviousData: true },
  )

  /**
   * Troca a categoria e volta à primeira página.
   * @param evento Mudança do seletor de categoria.
   */
  function aoMudarCategoria(evento: ChangeEvent<HTMLSelectElement>): void {
    setCategoria(evento.target.value as CategoriaFato | 'all')
    setLimite(PASSO)
  }

  /**
   * Troca o período e volta à primeira página.
   * @param evento Mudança do seletor de período.
   */
  function aoMudarPeriodo(evento: ChangeEvent<HTMLSelectElement>): void {
    setDias(Number(evento.target.value))
    setLimite(PASSO)
  }

  const temMais = data !== undefined && data.length === limite && limite < LIMITE_MAXIMO

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-categoria`} className="text-xs text-slate-400">
            Categoria
          </label>
          <select
            id={`${base}-categoria`}
            value={categoria}
            onChange={aoMudarCategoria}
            className="rounded-md border border-slate-700 bg-fundo px-3 py-2 text-sm text-slate-100"
          >
            <option value="all" className="bg-fundo text-slate-100">
              Todas
            </option>
            {CATEGORIAS_FATO.map((cat) => (
              <option key={cat} value={cat} className="bg-fundo text-slate-100">
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-periodo`} className="text-xs text-slate-400">
            Período
          </label>
          <select
            id={`${base}-periodo`}
            value={dias}
            onChange={aoMudarPeriodo}
            className="rounded-md border border-slate-700 bg-fundo px-3 py-2 text-sm text-slate-100"
          >
            {PERIODOS.map((periodo) => (
              <option key={periodo.valor} value={periodo.valor} className="bg-fundo text-slate-100">
                {periodo.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data && !error && <ListaCarregando />}

      {error && !data && (
        <div className="rounded-lg border border-slate-800 p-6 text-center">
          <p className="text-slate-300">Não foi possível carregar os comunicados agora.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <p className="rounded-lg border border-slate-800 p-6 text-center text-slate-400">
          Nenhum comunicado encontrado no período selecionado.
        </p>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3" aria-busy={isLoading}>
          {data.map((fato) => (
            <li key={fato.id}>
              <CartaoFato fato={fato} />
            </li>
          ))}
        </ul>
      )}

      {temMais && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setLimite((atual) => Math.min(atual + PASSO, LIMITE_MAXIMO))}
            disabled={isLoading}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Skeleton de três cards exibido durante o primeiro carregamento.
 * @returns Lista de placeholders animados.
 */
function ListaCarregando() {
  return (
    <ul className="space-y-3" aria-label="Carregando comunicados">
      {[0, 1, 2].map((indice) => (
        <li
          key={indice}
          className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-800/40"
        />
      ))}
    </ul>
  )
}

/**
 * Card de um comunicado: categoria, data, título, resumo com "ver mais" e link para o original.
 * @param props.fato Comunicado a exibir.
 * @returns Cartão do comunicado.
 */
function CartaoFato({ fato }: { fato: Fato }) {
  const [expandido, setExpandido] = useState(false)

  return (
    <article className="rounded-lg border border-slate-800 p-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-full border px-2 py-0.5 font-medium ${CLASSES_CATEGORIA[fato.categoria]}`}
        >
          {fato.categoria}
        </span>
        <time dateTime={fato.dataPublicacao} className="text-slate-400">
          {formatarData(fato.dataPublicacao)}
        </time>
      </div>

      <h3 className="mt-2 font-semibold text-slate-100">{fato.titulo}</h3>

      {fato.resumo && (
        <div className="mt-1">
          <p className={`text-sm text-slate-300 ${expandido ? '' : 'line-clamp-2'}`}>
            {fato.resumo}
          </p>
          <button
            type="button"
            onClick={() => setExpandido((atual) => !atual)}
            className="mt-1 text-xs text-slate-400 hover:text-slate-100 hover:underline"
          >
            {expandido ? 'ver menos' : 'ver mais'}
          </button>
        </div>
      )}

      <a
        href={fato.urlOriginal}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm text-slate-300 hover:text-slate-100 hover:underline"
      >
        Ver documento original
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </article>
  )
}
