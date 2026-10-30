/**
 * Skeleton da página de detalhe, exibido durante a navegação e a busca dos dados.
 * @returns Placeholder animado com o layout do cabeçalho e das abas.
 */
export default function LoadingDetalhe() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6" role="status" aria-label="Carregando ativo">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-800" />
      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="space-y-2 text-right">
          <div className="ml-auto h-8 w-40 animate-pulse rounded bg-slate-800" />
          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-lg bg-slate-800/60" />
    </main>
  )
}
