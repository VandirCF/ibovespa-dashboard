'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatarHora } from '@/lib/formatters'
import BadgeMercado from './BadgeMercado'
import BotaoTema from './BotaoTema'

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
 * Cabeçalho do app: logo, status do mercado, horário da última atualização, busca e tema.
 * @param props.atualizadoEm Horário da última atualização (opcional).
 * @param props.children Conteúdo extra à direita (ex.: BuscaAtivo).
 * @param props.largura Largura do conteúdo.
 * @returns Barra superior fixa com destaque.
 */
export default function Cabecalho({ atualizadoEm, children, largura = 'padrao' }: PropsCabecalho) {
  const classeLargura =
    largura === 'total' ? 'w-full px-4 sm:px-6 lg:px-8' : 'mx-auto max-w-6xl px-4'

  return (
    <header className="barra-topo sticky top-0 z-10 backdrop-blur">
      <div className={`flex flex-wrap items-center gap-4 py-4 ${classeLargura}`}>
        <Link
          href="/"
          className="text-4xl font-extrabold leading-none tracking-tight text-slate-100"
        >
          IBovespa <span className="text-alta">Dashboard</span>
        </Link>

        <BadgeMercado />

        {atualizadoEm !== undefined && (
          <div className="order-last w-full text-sm text-slate-400 sm:order-none sm:ml-auto sm:w-auto">
            {atualizadoEm ? `Atualizado às ${formatarHora(atualizadoEm)}` : 'Carregando cotações…'}
          </div>
        )}

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">{children}</div>
          <BotaoTema />
        </div>
      </div>
    </header>
  )
}
