'use client'

import { useEffect, useState } from 'react'
import { estaAbertoB3 } from '@/lib/mercado'

/**
 * Badge com o status do mercado no horário de referência (10h–18h, dias úteis, Brasília).
 * Atualiza a cada minuto. Só calcula no cliente para evitar divergência na hidratação.
 * @returns Badge "Mercado aberto" ou "Mercado fechado".
 */
export default function BadgeMercado() {
  const [aberto, setAberto] = useState<boolean | null>(null)

  useEffect(() => {
    const atualizar = (): void => setAberto(estaAbertoB3())
    atualizar()
    const id = setInterval(atualizar, 60_000)
    return () => clearInterval(id)
  }, [])

  if (aberto === null) {
    return <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">…</span>
  }
  return aberto ? (
    <span className="rounded-full bg-alta/20 px-3 py-1 text-sm font-medium text-alta">
      Mercado aberto
    </span>
  ) : (
    <span className="rounded-full bg-slate-700/60 px-3 py-1 text-sm font-medium text-slate-300">
      Mercado fechado
    </span>
  )
}
