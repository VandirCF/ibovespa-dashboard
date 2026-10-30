'use client'

import useSWR from 'swr'
import type { AtivoPreco, TipoAtivo } from '@/types'
import { LISTA_REFRESH_MS } from '@/lib/constants'
import { buscarAtivos } from '@/services/ativosService'

/** Prefixo da chave SWR: busca e lista usam o mesmo cache por tipo, sem chamadas extras. */
export const CHAVE_ATIVOS = 'ativos'

/**
 * Hook da lista de ativos de um tipo, com revalidação a cada 5 minutos.
 * @param tipo Ações do IBovespa (`acao`) ou fundos imobiliários (`fii`).
 * @param inicial Dados vindos do servidor, usados enquanto a busca do cliente não termina.
 * @returns Estado SWR com `data`, `error`, `isLoading` e `mutate` (para "tentar novamente").
 */
export function useAtivos(tipo: TipoAtivo = 'acao', inicial?: AtivoPreco[]) {
  return useSWR<AtivoPreco[]>([CHAVE_ATIVOS, tipo], () => buscarAtivos(tipo), {
    fallbackData: inicial,
    refreshInterval: LISTA_REFRESH_MS,
    revalidateOnFocus: false,
  })
}

/**
 * Ações e fundos imobiliários juntos, para a busca encontrar qualquer ativo.
 * @returns Lista combinada (vazia enquanto carrega).
 */
export function useTodosAtivos(): AtivoPreco[] {
  const { data: acoes } = useAtivos('acao')
  const { data: fiis } = useAtivos('fii')
  return [...(acoes ?? []), ...(fiis ?? [])]
}
