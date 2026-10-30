'use client'

import { useTema } from './ProvedorTema'

/**
 * Botão que alterna entre o modo escuro e o modo claro.
 * @returns Botão com ícone de sol (vai para claro) ou lua (vai para escuro).
 */
export default function BotaoTema() {
  const { tema, alternar } = useTema()
  const proximo = tema === 'escuro' ? 'claro' : 'escuro'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Ativar modo ${proximo}`}
      title={`Modo ${proximo}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-700 text-slate-200 transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {tema === 'escuro' ? (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
