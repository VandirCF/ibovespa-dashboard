'use client'

import useSWR from 'swr'
import type { AtivoPreco } from '@/types'
import { LISTA_REFRESH_MS } from '@/lib/constants'
import { buscarAtivos } from '@/services/ativosService'

/** Chave SWR compartilhada: busca e lista usam o mesmo cache, sem chamadas extras. */
export const CHAVE_ATIVOS = 'ativos'

/**
 * Hook da lista de ativos com revalidação a cada 5 minutos.
 * @param inicial Dados vindos do servidor, usados enquanto a busca do cliente não termina.
 * @returns Estado SWR com `data`, `error`, `isLoading` e `mutate` (para "tentar novamente").
 */
export function useAtivos(inicial?: AtivoPreco[]) {
  return useSWR<AtivoPreco[]>(CHAVE_ATIVOS, () => buscarAtivos(), {
    fallbackData: inicial,
    refreshInterval: LISTA_REFRESH_MS,
    revalidateOnFocus: false,
  })
}
