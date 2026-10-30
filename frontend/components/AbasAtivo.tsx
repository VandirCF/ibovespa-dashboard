'use client'

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'

/** Aba com rótulo e conteúdo. */
export interface AbaAtivo {
  id: string
  rotulo: string
  conteudo: ReactNode
}

interface PropsAbasAtivo {
  abas: AbaAtivo[]
}

/**
 * Abas acessíveis (padrão WAI-ARIA tabs) que trocam o conteúdo sem recarregar a página.
 * Setas ← → movem entre as abas; Home e End vão à primeira e à última.
 * @param props.abas Lista de abas com rótulo e conteúdo.
 * @returns Lista de abas e painel ativo.
 */
export default function AbasAtivo({ abas }: PropsAbasAtivo) {
  const [ativa, setAtiva] = useState(abas[0]?.id ?? '')
  const base = useId()

  /**
   * Navega entre as abas pelo teclado.
   * @param evento Evento de teclado no botão da aba.
   * @param indice Índice da aba que recebeu o foco.
   */
  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    let proximo: number | null = null
    if (evento.key === 'ArrowRight') proximo = (indice + 1) % abas.length
    else if (evento.key === 'ArrowLeft') proximo = (indice - 1 + abas.length) % abas.length
    else if (evento.key === 'Home') proximo = 0
    else if (evento.key === 'End') proximo = abas.length - 1
    if (proximo === null) return

    evento.preventDefault()
    const aba = abas[proximo]
    setAtiva(aba.id)
    document.getElementById(`${base}-tab-${aba.id}`)?.focus()
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções do ativo"
        className="flex gap-1 border-b border-slate-800"
      >
        {abas.map((aba, indice) => {
          const selecionada = aba.id === ativa
          return (
            <button
              key={aba.id}
              id={`${base}-tab-${aba.id}`}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={`${base}-panel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtiva(aba.id)}
              onKeyDown={(evento) => aoTeclar(evento, indice)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                selecionada
                  ? 'border-alta text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {aba.rotulo}
            </button>
          )
        })}
      </div>

      {abas.map((aba) => (
        <div
          key={aba.id}
          id={`${base}-panel-${aba.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${aba.id}`}
          hidden={aba.id !== ativa}
          tabIndex={0}
          className="pt-6 focus:outline-none"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  )
}
