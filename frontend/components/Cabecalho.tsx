'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { formatarHora } from '@/lib/formatters'
import { estaAbertoB3 } from '@/lib/mercado'

interface PropsCabecalho {
  /** Momento em que os dados foram recebidos pela última vez; null enquanto carrega. */
  atualizadoEm: Date | null
  /** Elementos extras (ex.: campo de busca). */
  children?: ReactNode
}

/**
 * Cabeçalho do app: logo, indicador de mercado, horário da última atualização e busca.
 * @param props.atualizadoEm Horário da última atualização dos dados.
 * @param props.children Conteúdo extra à direita (ex.: BuscaAtivo).
 * @returns Barra superior fixa.
 */
export default function Cabecalho({ atualizadoEm, children }: PropsCabecalho) {
  // null até o primeiro render no cliente, para evitar divergência de hidratação.
  const [aberto, setAberto] = useState<boolean | null>(null)

  useEffect(() => {
    const atualizar = (): void => setAberto(estaAbertoB3())
    atualizar()
    const id = setInterval(atualizar, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-fundo/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
          IBovespa <span className="text-alta">Dashboard</span>
        </Link>

        <BadgeMercado aberto={aberto} />

        <div className="order-last w-full text-xs text-slate-400 sm:order-none sm:w-auto sm:ml-auto">
          {atualizadoEm ? `Atualizado às ${formatarHora(atualizadoEm)}` : 'Carregando cotações…'}
        </div>

        <div className="w-full sm:w-auto">{children}</div>
      </div>
    </header>
  )
}

/**
 * Badge que mostra se o mercado está aberto no horário de referência.
 * @param props.aberto true = aberto, false = fechado, null = ainda não calculado.
 * @returns Badge colorido com o status.
 */
function BadgeMercado({ aberto }: { aberto: boolean | null }) {
  if (aberto === null) {
    return <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">…</span>
  }
  return aberto ? (
    <span className="rounded-full bg-alta/20 px-2.5 py-0.5 text-xs font-medium text-alta">
      Mercado aberto
    </span>
  ) : (
    <span className="rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-300">
      Mercado fechado
    </span>
  )
}
