'use client'

import { useRouter } from 'next/navigation'

interface PropsErroCarregamento {
  /** Mensagem amigável exibida ao usuário. */
  mensagem: string
}

/**
 * Estado de erro com mensagem amigável e botão para tentar novamente.
 * "Tentar novamente" refaz a renderização do servidor (router.refresh).
 * @param props.mensagem Texto explicando o problema.
 * @returns Bloco de erro com botão.
 */
export default function ErroCarregamento({ mensagem }: PropsErroCarregamento) {
  const router = useRouter()
  return (
    <div className="rounded-lg border border-slate-800 p-6 text-center">
      <p className="text-slate-300">{mensagem}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
      >
        Tentar novamente
      </button>
    </div>
  )
}
