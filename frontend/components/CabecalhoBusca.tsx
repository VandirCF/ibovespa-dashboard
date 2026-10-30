'use client'

import { useTodosAtivos } from '@/hooks/useAtivos'
import BuscaAtivo from './BuscaAtivo'
import Cabecalho from './Cabecalho'

/**
 * Cabeçalho com busca para páginas que não mostram a lista (ex.: detalhe do ativo).
 * Busca em ações e fundos imobiliários, usando o mesmo cache SWR da home.
 * @returns Cabeçalho com o campo de busca.
 */
export default function CabecalhoBusca() {
  const ativos = useTodosAtivos()
  return (
    <Cabecalho largura="total">
      <BuscaAtivo ativos={ativos} />
    </Cabecalho>
  )
}
