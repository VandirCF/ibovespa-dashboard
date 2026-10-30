'use client'

import { useEffect, useState } from 'react'
import type { AtivoPreco } from '@/types'
import { useAtivos } from '@/hooks/useAtivos'
import Cabecalho from './Cabecalho'
import BuscaAtivo from './BuscaAtivo'
import ListaAtivos from './ListaAtivos'

interface PropsPainelAtivos {
  /** Lista carregada no servidor (evita tela vazia na primeira pintura). */
  inicial?: AtivoPreco[]
}

/**
 * Página de lista de ativos: conecta o hook SWR ao cabeçalho, à busca e à tabela.
 * @param props.inicial Dados iniciais vindos do servidor.
 * @returns Cabeçalho, título e tabela de ativos.
 */
export default function PainelAtivos({ inicial }: PropsPainelAtivos) {
  const { data, error, isLoading, mutate } = useAtivos(inicial)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  useEffect(() => {
    if (data) setAtualizadoEm(new Date())
  }, [data])

  return (
    <>
      <Cabecalho atualizadoEm={atualizadoEm} largura="total">
        <BuscaAtivo ativos={data ?? []} />
      </Cabecalho>

      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">Principais ativos do IBovespa</h1>
        <ListaAtivos
          ativos={data}
          carregando={isLoading}
          erro={Boolean(error)}
          onTentarNovamente={() => void mutate()}
        />
      </main>
    </>
  )
}
