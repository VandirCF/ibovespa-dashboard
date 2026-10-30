import { z } from 'zod'
import { CATEGORIAS_FATO, type CategoriaFato, type Fato } from '@/types'

/** URL base do backend Fastify. Não é segredo; pode ser exposta ao cliente. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const FatoSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  categoria: z.enum(CATEGORIAS_FATO),
  dataPublicacao: z.string(),
  resumo: z.string().nullable(),
  urlOriginal: z.string(),
})

const FatosSchema = z.array(FatoSchema)

/** Filtros enviados à API de fatos relevantes. */
export interface FiltrosFatosBusca {
  /** Categoria exata, ou `all` para todas. */
  categoria: CategoriaFato | 'all'
  /** Número de dias para trás (30, 90 ou 180 na interface). */
  dias: number
  /** Quantidade máxima de comunicados retornados. */
  limite: number
}

/**
 * Busca os comunicados de um ativo com os filtros pedidos.
 * @param ticker Ticker já validado, ex.: "PETR4".
 * @param filtros Categoria, período em dias e limite.
 * @returns Comunicados ordenados do mais recente para o mais antigo.
 * @throws Error se a API falhar ou o formato da resposta for inesperado.
 */
export async function buscarFatos(ticker: string, filtros: FiltrosFatosBusca): Promise<Fato[]> {
  const parametros = new URLSearchParams({
    categoria: filtros.categoria,
    dias: String(filtros.dias),
    limite: String(filtros.limite),
  })
  const resposta = await fetch(`${API_URL}/api/ativos/${ticker}/fatos?${parametros.toString()}`)
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar os comunicados (HTTP ${resposta.status})`)
  }
  const dados: unknown = await resposta.json()
  return FatosSchema.parse(dados)
}
