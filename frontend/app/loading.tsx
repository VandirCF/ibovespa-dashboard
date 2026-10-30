/**
 * Skeleton exibido pelo Next.js durante a navegação entre rotas (streaming).
 * @returns Placeholder animado com o layout da lista.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6" role="status" aria-label="Carregando">
      <div className="mb-4 h-6 w-64 animate-pulse rounded bg-slate-800" />
      <div className="overflow-hidden rounded-lg border border-slate-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-4 border-t border-slate-800 px-3 py-3 first:border-t-0"
          >
            <div className="h-4 w-16 rounded bg-slate-800" />
            <div className="hidden h-4 flex-1 rounded bg-slate-800 md:block" />
            <div className="h-4 w-20 rounded bg-slate-800" />
          </div>
        ))}
      </div>
    </main>
  )
}
