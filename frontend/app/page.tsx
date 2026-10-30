import type { TipoAtivo } from '@/types'
import PainelAtivos from '@/components/PainelAtivos'
import { LISTA_REVALIDATE_SEGUNDOS } from '@/lib/constants'
import { buscarAtivosNoServidor } from '@/services/ativosService'

/** Revalidação automática da página (T-007: a cada 300 segundos). */
export const revalidate = LISTA_REVALIDATE_SEGUNDOS

interface PropsHome {
  searchParams: { tipo?: string }
}

/**
 * Home: lista de ações do IBovespa ou de fundos imobiliários (`?tipo=fii`).
 * Os dados iniciais vêm do servidor; se a API estiver fora, o cliente tenta de novo e mostra o skeleton.
 * @param props.searchParams Parâmetros da URL; `tipo=fii` abre a lista de fundos.
 * @returns Painel com cabeçalho, seletor, busca e tabela.
 */
export default async function Home({ searchParams }: PropsHome) {
  const tipo: TipoAtivo = searchParams.tipo === 'fii' ? 'fii' : 'acao'
  const inicial = await buscarAtivosNoServidor(tipo).catch(() => undefined)
  return <PainelAtivos inicial={inicial} tipoInicial={tipo} />
}
