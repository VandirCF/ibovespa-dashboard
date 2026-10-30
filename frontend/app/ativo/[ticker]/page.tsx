import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import type { AtivoPreco } from '@/types'
import AbasAtivo, { type AbaAtivo } from '@/components/AbasAtivo'
import BadgeMercado from '@/components/BadgeMercado'
import CabecalhoBusca from '@/components/CabecalhoBusca'
import ErroCarregamento from '@/components/ErroCarregamento'
import GraficoCandlestick from '@/components/GraficoCandlestick'
import { LISTA_REVALIDATE_SEGUNDOS } from '@/lib/constants'
import { formatarMoeda, formatarVariacao } from '@/lib/formatters'
import { buscarAtivoNoServidor } from '@/services/ativosService'

/** Revalidação automática da página de detalhe (T-009: 300 segundos). */
export const revalidate = LISTA_REVALIDATE_SEGUNDOS

/** Formato de ticker B3 aceito na URL (ex.: PETR4, ENGI11). */
const TICKER_URL_REGEX = /^[A-Z]{4}\d{1,2}$/

interface PropsDetalhe {
  params: { ticker: string }
}

/**
 * Normaliza o ticker vindo da URL.
 * @param bruto Parâmetro da rota.
 * @returns Ticker em maiúsculas, sem espaços.
 */
function normalizarParametro(bruto: string): string {
  return bruto.trim().toUpperCase()
}

/**
 * Classe Tailwind conforme o sinal da variação.
 * @param percentual Variação percentual do dia.
 * @returns Classe de cor.
 */
function classeVariacao(percentual: number): string {
  if (percentual > 0) return 'text-alta'
  if (percentual < 0) return 'text-baixa'
  return 'text-slate-400'
}

/**
 * Metadados de SEO: título e descrição com o preço atual.
 * @param props.params Parâmetros da rota.
 * @returns Metadados da página.
 */
export async function generateMetadata({ params }: PropsDetalhe): Promise<Metadata> {
  const ticker = normalizarParametro(params.ticker)
  try {
    const ativo = await buscarAtivoNoServidor(ticker)
    if (ativo) {
      return {
        title: `${ticker} - ${ativo.nome} | IBovespa Dashboard`,
        description: `${ticker} (${ativo.nome}) cotado a ${formatarMoeda(ativo.preco)}, variação de ${formatarVariacao(ativo.variacaoPercent)} no dia.`,
      }
    }
  } catch {
    // Sem dados: o título genérico abaixo é usado e a página mostra o estado de erro.
  }
  return { title: `${ticker} | IBovespa Dashboard` }
}

/**
 * Moldura comum da página de detalhe: busca no topo, breadcrumb e área principal.
 * @param props.ticker Ticker exibido no breadcrumb.
 * @param props.children Conteúdo da página.
 * @returns Estrutura da página.
 */
function MolduraDetalhe({ ticker, children }: { ticker: string; children: ReactNode }) {
  return (
    <>
      <CabecalhoBusca />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-200 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-slate-200">
              {ticker}
            </li>
          </ol>
        </nav>
        {children}
      </main>
    </>
  )
}

/**
 * Página de detalhe do ativo: cotação, badge de mercado, abas e voltar para a lista.
 * @param props.params Parâmetros da rota, com o ticker.
 * @returns Página renderizada no servidor.
 */
export default async function DetalheAtivo({ params }: PropsDetalhe) {
  const ticker = normalizarParametro(params.ticker)
  if (!TICKER_URL_REGEX.test(ticker)) {
    notFound()
  }

  let ativo: AtivoPreco | null = null
  try {
    ativo = await buscarAtivoNoServidor(ticker)
  } catch {
    return (
      <MolduraDetalhe ticker={ticker}>
        <div className="mt-6">
          <ErroCarregamento mensagem="Não foi possível carregar a cotação agora." />
        </div>
      </MolduraDetalhe>
    )
  }

  if (!ativo) {
    return (
      <MolduraDetalhe ticker={ticker}>
        <div className="mt-6">
          <ErroCarregamento mensagem={`Não há cotação disponível para ${ticker} no momento.`} />
        </div>
      </MolduraDetalhe>
    )
  }

  const abas: AbaAtivo[] = [
    {
      id: 'grafico',
      rotulo: 'Gráfico',
      conteudo: <GraficoCandlestick ticker={ticker} />,
    },
    {
      id: 'fatos',
      rotulo: 'Fatos relevantes',
      conteudo: <p className="text-slate-400">Comunicados da B3 em desenvolvimento.</p>,
    },
    {
      id: 'ia',
      rotulo: 'Recomendação IA',
      conteudo: <p className="text-slate-400">Análise com IA em desenvolvimento.</p>,
    },
  ]

  return (
    <MolduraDetalhe ticker={ticker}>
      <section className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {ativo.ticker}{' '}
            <span className="text-base font-normal text-slate-400">{ativo.nome}</span>
          </h1>
          {ativo.setor && <p className="mt-1 text-sm text-slate-400">{ativo.setor}</p>}
        </div>

        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums text-slate-100">
            {formatarMoeda(ativo.preco)}
          </p>
          <p className={`font-medium tabular-nums ${classeVariacao(ativo.variacaoPercent)}`}>
            {formatarVariacao(ativo.variacaoPercent)}{' '}
            <span className="text-sm">({formatarMoeda(ativo.variacao)})</span>
          </p>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <BadgeMercado />
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-100 hover:underline">
          ← Voltar para a lista
        </Link>
      </div>

      <div className="mt-6">
        <AbasAtivo abas={abas} />
      </div>
    </MolduraDetalhe>
  )
}
