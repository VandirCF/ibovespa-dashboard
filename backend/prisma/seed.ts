import { PrismaClient } from '@prisma/client'
import { ATIVOS_IBOVESPA } from '../lib/ativos-ibovespa'

const prisma = new PrismaClient()

/**
 * Popula a tabela Ativo com os 50 principais ativos do IBovespa.
 * Usa upsert por ticker, então é seguro executar várias vezes.
 * @returns Quantidade de ativos gravados.
 */
export async function popularAtivos(): Promise<number> {
  for (const ativo of ATIVOS_IBOVESPA) {
    await prisma.ativo.upsert({
      where: { ticker: ativo.ticker },
      update: { nome: ativo.nome, setor: ativo.setor, subsector: ativo.subsector },
      create: ativo,
    })
  }
  return ATIVOS_IBOVESPA.length
}

if (require.main === module) {
  popularAtivos()
    .then((total: number) => {
      console.log(`Seed concluído: ${total} ativos`)
    })
    .catch((erro: unknown) => {
      console.error('Falha no seed', erro)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
