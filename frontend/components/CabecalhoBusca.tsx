'use client'

import { useAtivos } from '@/hooks/useAtivos'
import BuscaAtivo from './BuscaAtivo'
import Cabecalho from './Cabecalho'

/**
 * Cabeçalho com busca para páginas que não mostram a lista (ex.: detalhe do ativo).
 * Usa o mesmo cache SWR da lista, então não repete a chamada se ela já foi feita.
 * @returns Cabeçalho com o campo de busca.
 */
export default function CabecalhoBusca() {
  const { data } = useAtivos()
  return (
    <Cabecalho largura="total">
      <BuscaAtivo ativos={data ?? []} />
    </Cabecalho>
  )
}
