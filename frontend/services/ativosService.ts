import { z } from 'zod'
import type { AtivoPreco } from '@/types'
import { LISTA_REVALIDATE_SEGUNDOS } from '@/lib/constants'

/** URL base do backend Fastify. Não é segredo; pode ser exposta ao cliente. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const AtivoPrecoSchema = z.object({
  ticker: z.string(),
  nome: z.string(),
  preco: z.number(),
  variacao: z.number(),
  variacaoPercent: z.number(),
  volume: z.number(),
  marketCap: z.number().nullable(),
  setor: z.string().optional(),
})

const ListaAtivosSchema = z.array(AtivoPrecoSchema)

/**
 * Busca a lista de ativos na API do backend. Funciona no cliente e no servidor.
 * @param opcoes Opções extras do fetch (ex.: revalidação do Next.js).
 * @returns Lista de ativos validada.
 * @throws Error se a resposta não for 2xx ou se o formato for inesperado.
 */
export async function buscarAtivos(opcoes?: RequestInit): Promise<AtivoPreco[]> {
  const resposta = await fetch(`${API_URL}/api/ativos`, opcoes)
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar ativos (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return ListaAtivosSchema.parse(dados)
}

/**
 * Busca a lista de ativos no servidor do Next.js com revalidação de 300s.
 * @returns Lista de ativos validada.
 * @throws Error se a API estiver indisponível.
 */
export async function buscarAtivosNoServidor(): Promise<AtivoPreco[]> {
  return buscarAtivos({ next: { revalidate: LISTA_REVALIDATE_SEGUNDOS } } as RequestInit)
}

/**
 * Busca a cotação de um ativo no servidor do Next.js, com revalidação de 300s.
 * @param ticker Ticker já validado, ex.: "PETR4".
 * @returns Cotação do ativo, ou null se a API não tiver cotação para ele (404).
 * @throws Error se a API estiver indisponível (5xx ou falha de rede).
 */
export async function buscarAtivoNoServidor(ticker: string): Promise<AtivoPreco | null> {
  const resposta = await fetch(`${API_URL}/api/ativos/${ticker}`, {
    next: { revalidate: LISTA_REVALIDATE_SEGUNDOS },
  } as RequestInit)
  if (resposta.status === 404) return null
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar ${ticker} (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return AtivoPrecoSchema.parse(dados)
}
