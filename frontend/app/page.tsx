import PainelAtivos from '@/components/PainelAtivos'
import { LISTA_REVALIDATE_SEGUNDOS } from '@/lib/constants'
import { buscarAtivosNoServidor } from '@/services/ativosService'

/** Revalidação automática da página (T-007: a cada 300 segundos). */
export const revalidate = LISTA_REVALIDATE_SEGUNDOS

/**
 * Home: lista de ativos do IBovespa. Os dados iniciais vêm do servidor;
 * se a API estiver fora, o cliente tenta de novo e mostra o skeleton.
 * @returns Painel com cabeçalho, busca e tabela.
 */
export default async function Home() {
  const inicial = await buscarAtivosNoServidor().catch(() => undefined)
  return <PainelAtivos inicial={inicial} />
}
