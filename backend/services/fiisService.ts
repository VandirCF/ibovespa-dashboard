import type { AtivoPreco, IndicadoresFii } from '../types'
import { PRECO_TTL, cache } from '../lib/cache'
import { getTabelaFiis, type LinhaFii } from './fundamentusService'
import { chaveCotacaoBackground, chaveFechamento } from './statusInvestService'

/** Quantidade de FIIs exibidos na home: os mais líquidos da tabela do Fundamentus. */
export const QTD_FIIS_PRINCIPAIS = 50

/**
 * Seleciona os fundos mais líquidos, descartando os sem cotação ou sem negociação.
 * @param linhas Fundos da tabela do Fundamentus.
 * @param quantidade Quantos fundos manter.
 * @returns Fundos ordenados da maior para a menor liquidez.
 */
export function selecionarFiisPrincipais(
  linhas: Iterable<LinhaFii>,
  quantidade: number = QTD_FIIS_PRINCIPAIS,
): LinhaFii[] {
  return [...linhas]
    .filter((linha) => linha.cotacao !== null && (linha.liquidez ?? 0) > 0)
    .sort((a, b) => (b.liquidez ?? 0) - (a.liquidez ?? 0))
    .slice(0, quantidade)
}

/**
 * Converte a linha do Fundamentus em cotação. A fonte traz o fechamento do último pregão,
 * então a variação fica nula até o job de cotações preencher.
 * @param linha Linha do fundo na tabela de FIIs, se existir.
 * @returns Cotação do fundo ou null.
 */
export function cotacaoDoFii(linha: LinhaFii | undefined): AtivoPreco | null {
  if (!linha || linha.cotacao === null) return null
  return {
    ticker: linha.ticker,
    nome: linha.nome,
    preco: linha.cotacao,
    variacao: null,
    variacaoPercent: null,
    liquidez: linha.liquidez,
    marketCap: linha.valorMercado,
    setor: linha.segmento ?? undefined,
    tipo: 'fii',
  }
}

/**
 * Lista dos fundos imobiliários mais líquidos, com cache de 5 minutos.
 * Preço e variação vêm do job de cotações (Status Invest) ou do fechamento guardado;
 * sem eles, fica o fechamento do Fundamentus sem variação.
 * @returns Fundos na ordem de liquidez.
 * @throws Erro se a tabela de FIIs estiver indisponível (não grava cache vazio).
 */
export async function getListaFiis(): Promise<AtivoPreco[]> {
  return cache.getOrSet('lista:fiis', PRECO_TTL, async (): Promise<AtivoPreco[]> => {
    const principais = selecionarFiisPrincipais((await getTabelaFiis()).values())
    if (principais.length === 0) throw new Error('Tabela de FIIs do Fundamentus indisponível')

    const lista: AtivoPreco[] = []
    for (const linha of principais) {
      const base = cotacaoDoFii(linha)
      if (!base) continue
      const doJob =
        (await cache.get<AtivoPreco>(chaveCotacaoBackground(linha.ticker))) ??
        (await cache.get<AtivoPreco>(chaveFechamento(linha.ticker)))
      lista.push(
        doJob
          ? {
              ...base,
              preco: doJob.preco,
              variacao: doJob.variacao,
              variacaoPercent: doJob.variacaoPercent,
              atualizadoEm: doJob.atualizadoEm,
            }
          : base,
      )
    }
    return lista
  })
}

/**
 * Indicadores de um fundo imobiliário a partir da tabela do Fundamentus.
 * @param ticker Ticker normalizado, ex.: KNRI11.
 * @returns Indicadores do fundo ou null se ele não estiver na tabela.
 */
export async function getIndicadoresFii(ticker: string): Promise<IndicadoresFii | null> {
  const linha = (await getTabelaFiis()).get(ticker)
  if (!linha) return null
  return {
    ticker,
    segmento: linha.segmento,
    valorMercado: linha.valorMercado,
    pvp: linha.pvp,
    dividendYield: linha.dividendYield,
    ffoYield: linha.ffoYield,
    capRate: linha.capRate,
    vacancia: linha.vacancia,
    qtdImoveis: linha.qtdImoveis,
    precoM2: linha.precoM2,
    aluguelM2: linha.aluguelM2,
    liquidez: linha.liquidez,
  }
}
