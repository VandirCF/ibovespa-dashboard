'use client'

import { useEffect, useState } from 'react'
import type { AtivoPreco, TipoAtivo } from '@/types'
import { useAtivos } from '@/hooks/useAtivos'
import Cabecalho from './Cabecalho'
import BuscaAtivo from './BuscaAtivo'
import ListaAtivos from './ListaAtivos'

/** Opções do seletor da home, com o título exibido acima da tabela. */
const OPCOES_TIPO: { valor: TipoAtivo; rotulo: string; titulo: string }[] = [
  { valor: 'acao', rotulo: 'Ações (IBovespa)', titulo: 'Principais ativos do IBovespa' },
  {
    valor: 'fii',
    rotulo: 'Fundos imobiliários',
    titulo: 'Fundos imobiliários mais negociados',
  },
]

interface PropsPainelAtivos {
  /** Lista carregada no servidor (evita tela vazia na primeira pintura). */
  inicial?: AtivoPreco[]
  /** Tipo selecionado na URL ao abrir a página. */
  tipoInicial: TipoAtivo
}

/**
 * Página de lista de ativos: seletor entre ações e fundos imobiliários, busca e tabela.
 * A seleção fica na URL (`?tipo=fii`), para o link e o recarregamento manterem a escolha.
 * @param props.inicial Dados iniciais vindos do servidor para o tipo inicial.
 * @param props.tipoInicial Tipo lido da URL.
 * @returns Cabeçalho, seletor, título e tabela de ativos.
 */
export default function PainelAtivos({ inicial, tipoInicial }: PropsPainelAtivos) {
  const [tipo, setTipo] = useState<TipoAtivo>(tipoInicial)
  const acoes = useAtivos('acao', tipoInicial === 'acao' ? inicial : undefined)
  const fiis = useAtivos('fii', tipoInicial === 'fii' ? inicial : undefined)
  const atual = tipo === 'fii' ? fiis : acoes
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  useEffect(() => {
    if (atual.data) setAtualizadoEm(new Date())
  }, [atual.data])

  /**
   * Troca o tipo exibido e atualiza a URL sem recarregar a página.
   * @param novo Tipo escolhido no seletor.
   */
  function escolherTipo(novo: TipoAtivo): void {
    setTipo(novo)
    window.history.replaceState(null, '', novo === 'fii' ? '/?tipo=fii' : '/')
  }

  const opcao = OPCOES_TIPO.find((o) => o.valor === tipo) ?? OPCOES_TIPO[0]

  return (
    <>
      <Cabecalho atualizadoEm={atualizadoEm} largura="total">
        <BuscaAtivo ativos={[...(acoes.data ?? []), ...(fiis.data ?? [])]} />
      </Cabecalho>

      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div
          role="group"
          aria-label="Tipo de ativo"
          className="mb-4 inline-flex rounded-lg border border-slate-800 p-1"
        >
          {OPCOES_TIPO.map((item) => {
            const selecionado = item.valor === tipo
            return (
              <button
                key={item.valor}
                type="button"
                aria-pressed={selecionado}
                onClick={() => escolherTipo(item.valor)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  selecionado
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.rotulo}
              </button>
            )
          })}
        </div>

        <h1 className="mb-4 text-xl font-semibold text-slate-100">{opcao.titulo}</h1>
        <ListaAtivos
          ativos={atual.data}
          carregando={atual.isLoading}
          erro={Boolean(atual.error)}
          onTentarNovamente={() => void atual.mutate()}
          rotuloSetor={tipo === 'fii' ? 'Segmento' : 'Setor'}
        />
      </main>
    </>
  )
}
