'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type MouseEvent } from 'react'
import type { AtivoPreco } from '@/types'
import { formatarMoeda, formatarVariacao, formatarVolume } from '@/lib/formatters'

/** Campos ordenáveis da tabela. */
type Campo = 'ticker' | 'nome' | 'preco' | 'variacaoPercent' | 'volume' | 'setor'

interface Ordenacao {
  campo: Campo
  direcao: 'asc' | 'desc'
}

interface PropsListaAtivos {
  /** Dados atuais; undefined enquanto a primeira carga não terminou. */
  ativos: AtivoPreco[] | undefined
  /** true durante a carga inicial. */
  carregando: boolean
  /** true se a última busca falhou. */
  erro: boolean
  /** Ação do botão "Tentar novamente". */
  onTentarNovamente: () => void
}

/** Colunas da tabela, na ordem de exibição. */
const COLUNAS: { campo: Campo; rotulo: string; alinhamento: 'left' | 'right'; classe?: string }[] =
  [
    { campo: 'ticker', rotulo: 'Ticker', alinhamento: 'left' },
    { campo: 'nome', rotulo: 'Nome', alinhamento: 'left', classe: 'hidden md:table-cell' },
    { campo: 'preco', rotulo: 'Preço (R$)', alinhamento: 'right' },
    { campo: 'variacaoPercent', rotulo: 'Variação (%)', alinhamento: 'right' },
    { campo: 'volume', rotulo: 'Volume', alinhamento: 'right', classe: 'hidden sm:table-cell' },
    { campo: 'setor', rotulo: 'Setor', alinhamento: 'left', classe: 'hidden lg:table-cell' },
  ]

/**
 * Ordena a lista pelo campo e direção informados, sem mutar a original.
 * @param ativos Lista de ativos.
 * @param ordenacao Campo e direção.
 * @returns Nova lista ordenada.
 */
function ordenar(ativos: readonly AtivoPreco[], ordenacao: Ordenacao): AtivoPreco[] {
  const fator = ordenacao.direcao === 'asc' ? 1 : -1
  return [...ativos].sort((a, b) => {
    const { campo } = ordenacao
    if (campo === 'nome' || campo === 'ticker') {
      return a[campo].localeCompare(b[campo], 'pt-BR') * fator
    }
    if (campo === 'setor') {
      return (a.setor ?? '').localeCompare(b.setor ?? '', 'pt-BR') * fator
    }
    const valorA = a[campo]
    const valorB = b[campo]
    // Sem dado: a linha vai para o fim, em qualquer direção.
    if (valorA === null || valorB === null) {
      if (valorA === valorB) return 0
      return valorA === null ? 1 : -1
    }
    return (valorA - valorB) * fator
  })
}

/**
 * Texto da variação percentual, ou traço quando a fonte não a informa.
 * @param percentual Variação em percentual ou null.
 * @returns Texto formatado ou "—".
 */
function textoVariacao(percentual: number | null): string {
  return percentual === null ? '—' : formatarVariacao(percentual)
}

/**
 * Texto do volume, ou traço quando a fonte não o informa.
 * @param volume Volume negociado ou null.
 * @returns Texto compacto ou "—".
 */
function textoVolume(volume: number | null): string {
  return volume === null ? '—' : formatarVolume(volume)
}

/**
 * Classe de cor conforme o sinal da variação: alta (verde), baixa (vermelho) ou neutra.
 * @param percentual Variação percentual do dia.
 * @returns Classe Tailwind.
 */
function classeVariacao(percentual: number | null): string {
  if (percentual === null) return 'text-slate-400'
  if (percentual > 0) return 'text-alta'
  if (percentual < 0) return 'text-baixa'
  return 'text-slate-400'
}

/**
 * Tabela de ativos do IBovespa com ordenação por coluna, skeleton, erro com retry e linhas clicáveis.
 * @param props Dados, estados de carga/erro e ação de retry.
 * @returns Tabela responsiva.
 */
export default function ListaAtivos({
  ativos,
  carregando,
  erro,
  onTentarNovamente,
}: PropsListaAtivos) {
  const router = useRouter()
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({
    campo: 'variacaoPercent',
    direcao: 'desc',
  })

  const ordenados = useMemo(() => (ativos ? ordenar(ativos, ordenacao) : []), [ativos, ordenacao])

  if (erro && !ativos) {
    return (
      <div className="rounded-lg border border-slate-800 p-6 text-center">
        <p className="text-slate-300">Não foi possível carregar as cotações agora.</p>
        <button
          type="button"
          onClick={onTentarNovamente}
          className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (carregando && !ativos) {
    return <SkeletonTabela />
  }

  /**
   * Alterna a ordenação: mesmo campo inverte a direção; campo novo começa em ordem decrescente
   * para números e crescente para texto.
   * @param campo Coluna clicada.
   */
  function alternarOrdenacao(campo: Campo): void {
    setOrdenacao((atual) => {
      if (atual.campo === campo) {
        return { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
      }
      const textual = campo === 'ticker' || campo === 'nome' || campo === 'setor'
      return { campo, direcao: textual ? 'asc' : 'desc' }
    })
  }

  /**
   * Navega para o detalhe ao clicar na linha, exceto quando o clique já foi em um link.
   * @param evento Clique na linha.
   * @param ticker Ticker da linha.
   */
  function aoClicarLinha(evento: MouseEvent<HTMLTableRowElement>, ticker: string): void {
    if ((evento.target as HTMLElement).closest('a')) return
    router.push(`/ativo/${ticker}`)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full min-w-[320px] border-collapse text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {COLUNAS.map((coluna) => {
              const ativa = ordenacao.campo === coluna.campo
              return (
                <th
                  key={coluna.campo}
                  scope="col"
                  aria-sort={
                    ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className={`${coluna.classe ?? ''} px-3 py-2 text-${coluna.alinhamento}`}
                >
                  <button
                    type="button"
                    onClick={() => alternarOrdenacao(coluna.campo)}
                    className="inline-flex items-center gap-1 hover:text-slate-100"
                  >
                    {coluna.rotulo}
                    <span aria-hidden="true">
                      {ativa ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((ativo) => (
            <tr
              key={ativo.ticker}
              onClick={(evento) => aoClicarLinha(evento, ativo.ticker)}
              className="cursor-pointer border-t border-slate-800 transition-colors hover:bg-slate-800/60"
            >
              <td className="px-3 py-2 font-semibold">
                <Link
                  href={`/ativo/${ativo.ticker}`}
                  className="rounded text-slate-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  {ativo.ticker}
                </Link>
              </td>
              <td className="hidden max-w-[16rem] truncate px-3 py-2 text-slate-300 md:table-cell">
                {ativo.nome}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(ativo.preco)}</td>
              <td
                className={`px-3 py-2 text-right font-medium tabular-nums ${classeVariacao(ativo.variacaoPercent)}`}
              >
                {textoVariacao(ativo.variacaoPercent)}
              </td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-slate-300 sm:table-cell">
                {textoVolume(ativo.volume)}
              </td>
              <td className="hidden px-3 py-2 text-slate-400 lg:table-cell">
                {ativo.setor ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Skeleton da tabela exibido durante a primeira carga (sem layout shift: mesmas colunas).
 * @returns Linhas animadas.
 */
function SkeletonTabela() {
  return (
    <div
      role="status"
      aria-label="Carregando cotações"
      className="overflow-hidden rounded-lg border border-slate-800"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 border-t border-slate-800 px-3 py-3 first:border-t-0"
        >
          <div className="h-4 w-16 rounded bg-slate-800" />
          <div className="hidden h-4 flex-1 rounded bg-slate-800 md:block" />
          <div className="h-4 w-20 rounded bg-slate-800" />
          <div className="h-4 w-16 rounded bg-slate-800" />
          <div className="hidden h-4 w-16 rounded bg-slate-800 sm:block" />
        </div>
      ))}
    </div>
  )
}
