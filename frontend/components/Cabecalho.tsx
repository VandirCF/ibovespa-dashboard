'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatarHora } from '@/lib/formatters'
import BadgeMercado from './BadgeMercado'

interface PropsCabecalho {
  /**
   * Horário da última atualização dos dados. `undefined` oculta o texto (ex.: página de detalhe);
   * `null` mostra "Carregando" enquanto a primeira carga não terminou.
   */
  atualizadoEm?: Date | null
  /** Elementos extras à direita (ex.: campo de busca). */
  children?: ReactNode
  /** `padrao` centraliza com largura máxima; `total` ocupa a largura da tela (páginas de detalhe). */
  largura?: 'padrao' | 'total'
}

/**
 * Cabeçalho do app: logo, status do mercado, horário da última atualização e busca.
 * @param props.atualizadoEm Horário da última atualização (opcional).
 * @param props.children Conteúdo extra à direita (ex.: BuscaAtivo).
 * @returns Barra superior fixa.
 */
export default function Cabecalho({ atualizadoEm, children, largura = 'padrao' }: PropsCabecalho) {
  const classeLargura =
    largura === 'total' ? 'w-full px-4 sm:px-6 lg:px-8' : 'mx-auto max-w-6xl px-4'
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-fundo/90 backdrop-blur">
      <div className={`flex flex-wrap items-center gap-3 py-3 ${classeLargura}`}>
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
          IBovespa <span className="text-alta">Dashboard</span>
        </Link>

        <BadgeMercado />

        {atualizadoEm !== undefined && (
          <div className="order-last w-full text-xs text-slate-400 sm:order-none sm:ml-auto sm:w-auto">
            {atualizadoEm ? `Atualizado às ${formatarHora(atualizadoEm)}` : 'Carregando cotações…'}
          </div>
        )}

        <div className="w-full sm:w-auto">{children}</div>
      </div>
    </header>
  )
}
