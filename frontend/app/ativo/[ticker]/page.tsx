import Link from 'next/link'

interface PropsDetalhe {
  params: { ticker: string }
}

/**
 * Página de detalhe do ativo. Placeholder até a T-009 (Fase 2), para o link da lista não dar 404.
 * @param props.params Parâmetros da rota, com o ticker.
 * @returns Mensagem de placeholder com link de volta.
 */
export default function DetalheAtivo({ params }: PropsDetalhe) {
  const ticker = params.ticker.toUpperCase()
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-100">
        ← Voltar para a lista
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-100">{ticker}</h1>
      <p className="mt-2 text-slate-400">Página de detalhe em construção (T-009).</p>
    </main>
  )
}
