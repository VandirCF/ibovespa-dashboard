'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

interface PropsErroGlobal {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Fallback para erros de renderização não tratados. Envia o erro ao Sentry (se configurado)
 * e oferece nova tentativa ao usuário.
 * @param props.error Erro capturado pelo Next.js.
 * @param props.reset Função que tenta renderizar a página de novo.
 * @returns Documento HTML mínimo com a mensagem de erro.
 */
export default function ErroGlobal({ error, reset }: PropsErroGlobal) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <main className="p-6 text-center">
          <h1 className="text-xl font-semibold">Algo deu errado.</h1>
          <p className="mt-2 text-sm">Tente novamente em instantes.</p>
          <button type="button" onClick={() => reset()} className="mt-4 underline">
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  )
}
