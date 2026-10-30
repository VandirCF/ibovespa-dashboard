import { JOB_COLETA_DIARIA, obterFila } from '../jobs/coletaHistorico'

/**
 * Enfileira manualmente uma rodada de coleta. O worker precisa estar rodando (backend ligado).
 * @returns Promise que resolve após o job ser enfileirado.
 */
async function main(): Promise<void> {
  const fila = obterFila()
  const job = await fila.add(JOB_COLETA_DIARIA, {})
  console.log(`Job de coleta enfileirado: ${job.id}`)
  await fila.close()
  process.exit(0)
}

main().catch((erro: unknown) => {
  console.error('Falha ao enfileirar a coleta', erro)
  process.exitCode = 1
})
