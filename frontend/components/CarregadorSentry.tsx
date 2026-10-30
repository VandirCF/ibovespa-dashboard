'use client'

import { useEffect } from 'react'

/**
 * Carrega o Sentry do navegador depois da hidratação, e só se houver DSN pública.
 * Sem DSN, nada é importado e o bundle da página não cresce.
 * @returns null (componente sem interface).
 */
export function CarregadorSentry() {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
    void import('@/lib/sentryCliente').then((modulo) => modulo.iniciarSentryCliente())
  }, [])
  return null
}
