'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { AtivoPreco } from '@/types'
import { BUSCA_DEBOUNCE_MS, BUSCA_HISTORICO_MAX, BUSCA_MAX_RESULTADOS } from '@/lib/constants'

/** Chave do localStorage com o histórico de buscas (preferência local, não dado de usuário). */
const CHAVE_HISTORICO = 'ibov:buscas-recentes'

/** Mínimo de caracteres para a busca local (PRD 3.2: a partir do segundo caractere). */
const MIN_CARACTERES = 2

/** Opção exibida no dropdown. */
interface Opcao {
  ticker: string
  nome: string
  setor?: string
}

/**
 * Normaliza texto para comparação: minúsculas e sem acentos.
 * @param texto Texto original.
 * @returns Texto normalizado.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Filtra ativos localmente. Prioridade: ticker começa com o termo, ticker contém, nome contém.
 * @param ativos Lista já carregada em memória.
 * @param consulta Termo digitado (já com debounce).
 * @returns Até BUSCA_MAX_RESULTADOS ativos ordenados por relevância.
 */
export function filtrarAtivos(ativos: readonly AtivoPreco[], consulta: string): AtivoPreco[] {
  const termo = normalizar(consulta)
  if (termo.length < MIN_CARACTERES) return []

  const pontuados: { ativo: AtivoPreco; peso: number }[] = []
  for (const ativo of ativos) {
    const ticker = ativo.ticker.toLowerCase()
    if (ticker.startsWith(termo)) pontuados.push({ ativo, peso: 0 })
    else if (ticker.includes(termo)) pontuados.push({ ativo, peso: 1 })
    else if (normalizar(ativo.nome).includes(termo)) pontuados.push({ ativo, peso: 2 })
  }

  return pontuados
    .sort((a, b) => a.peso - b.peso || a.ativo.ticker.localeCompare(b.ativo.ticker))
    .slice(0, BUSCA_MAX_RESULTADOS)
    .map((p) => p.ativo)
}

/**
 * Lê o histórico de buscas do localStorage. Falhas (modo privado, bloqueio) retornam lista vazia.
 * @returns Tickers das buscas recentes, mais recente primeiro.
 */
function lerHistorico(): string[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_HISTORICO)
    if (!bruto) return []
    const valor: unknown = JSON.parse(bruto)
    if (!Array.isArray(valor)) return []
    return valor
      .filter((item): item is string => typeof item === 'string')
      .slice(0, BUSCA_HISTORICO_MAX)
  } catch {
    return []
  }
}

/**
 * Grava o histórico de buscas no localStorage. Falhas são ignoradas (a busca continua funcionando).
 * @param lista Tickers a salvar.
 */
function salvarHistorico(lista: string[]): void {
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista))
  } catch {
    // Armazenamento indisponível: o histórico simplesmente não persiste.
  }
}

interface PropsBuscaAtivo {
  /** Lista de ativos já carregada (busca local, sem chamada extra à API). */
  ativos: AtivoPreco[]
}

/**
 * Campo de busca com autocomplete por ticker ou nome, histórico e navegação por teclado.
 * @param props.ativos Lista de ativos usada para filtrar.
 * @returns Input com dropdown acessível (combobox/listbox).
 */
export default function BuscaAtivo({ ativos }: PropsBuscaAtivo) {
  const router = useRouter()
  const idLista = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  const [texto, setTexto] = useState('')
  const [consulta, setConsulta] = useState('')
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(-1)
  const [historico, setHistorico] = useState<string[]>([])

  // Lê o localStorage só no cliente, após a montagem.
  useEffect(() => {
    setHistorico(lerHistorico())
  }, [])

  // Debounce do termo digitado.
  useEffect(() => {
    const id = setTimeout(() => setConsulta(texto), BUSCA_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [texto])

  // Fecha o dropdown ao clicar fora do componente.
  useEffect(() => {
    const aoClicar = (evento: MouseEvent): void => {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [])

  const mostrandoHistorico = texto.trim() === ''

  const opcoes: Opcao[] = useMemo(() => {
    if (mostrandoHistorico) {
      return historico.map((ticker) => {
        const ativo = ativos.find((a) => a.ticker === ticker)
        return { ticker, nome: ativo?.nome ?? ticker, setor: ativo?.setor }
      })
    }
    return filtrarAtivos(ativos, consulta).map((a) => ({
      ticker: a.ticker,
      nome: a.nome,
      setor: a.setor,
    }))
  }, [ativos, consulta, historico, mostrandoHistorico])

  /**
   * Seleciona um ativo: salva no histórico e navega para o detalhe.
   * @param ticker Ticker escolhido.
   */
  function selecionar(ticker: string): void {
    const proximo = [ticker, ...historico.filter((t) => t !== ticker)].slice(0, BUSCA_HISTORICO_MAX)
    setHistorico(proximo)
    salvarHistorico(proximo)
    setAberto(false)
    setIndice(-1)
    setTexto('')
    setConsulta('')
    router.push(`/ativo/${ticker}`)
  }

  /**
   * Trata ↑ ↓ Enter e Escape no input.
   * @param evento Evento de teclado.
   */
  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAberto(true)
      setIndice((i) => (opcoes.length === 0 ? -1 : (i + 1) % opcoes.length))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setAberto(true)
      setIndice((i) => (opcoes.length === 0 ? -1 : i <= 0 ? opcoes.length - 1 : i - 1))
    } else if (evento.key === 'Enter') {
      const escolhida = indice >= 0 ? opcoes[indice] : opcoes[0]
      if (aberto && escolhida) {
        evento.preventDefault()
        selecionar(escolhida.ticker)
      }
    } else if (evento.key === 'Escape') {
      setAberto(false)
      setIndice(-1)
    }
  }

  const listaVisivel = aberto && opcoes.length > 0
  const semResultados =
    aberto && !mostrandoHistorico && consulta.length >= MIN_CARACTERES && opcoes.length === 0

  return (
    <div ref={containerRef} className="relative w-full sm:w-[28rem]">
      <input
        type="search"
        role="combobox"
        aria-label="Buscar ativo por ticker ou nome"
        aria-autocomplete="list"
        aria-expanded={listaVisivel}
        aria-controls={idLista}
        aria-activedescendant={listaVisivel && indice >= 0 ? `${idLista}-${indice}` : undefined}
        autoComplete="off"
        placeholder="Buscar: PETR4 ou Petrobras"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setIndice(-1)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-xl text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
      />

      {listaVisivel && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={mostrandoHistorico ? 'Buscas recentes' : 'Resultados da busca'}
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          {mostrandoHistorico && (
            <li
              role="presentation"
              className="px-3 pb-1 pt-1 text-xs uppercase tracking-wide text-slate-500"
            >
              Buscas recentes
            </li>
          )}
          {opcoes.map((opcao, i) => (
            <li
              key={opcao.ticker}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === indice}
              onMouseEnter={() => setIndice(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                selecionar(opcao.ticker)
              }}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm ${
                i === indice ? 'bg-slate-700/70' : 'hover:bg-slate-800'
              }`}
            >
              <span className="font-bold text-slate-100">{opcao.ticker}</span>
              <span className="truncate text-slate-400">{opcao.nome}</span>
              {opcao.setor && (
                <span className="ml-auto shrink-0 text-xs text-slate-500">{opcao.setor}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {semResultados && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 shadow-xl">
          Nenhum ativo encontrado para &ldquo;{consulta}&rdquo;
        </div>
      )}
    </div>
  )
}
