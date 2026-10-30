import { config } from 'dotenv'
import { resolve } from 'node:path'
import { z } from 'zod'

config({ path: resolve(__dirname, '..', '.env') })

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  BRAPI_TOKEN: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

/**
 * Valida as variáveis de ambiente na inicialização. Falha cedo se algo estiver inválido.
 * @returns Variáveis de ambiente tipadas.
 * @throws ZodError se alguma variável obrigatória estiver ausente ou inválida.
 */
export function carregarEnv(): Env {
  const resultado = EnvSchema.safeParse(process.env)
  if (!resultado.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${resultado.error.message}`)
  }
  return resultado.data
}

export const env: Env = carregarEnv()
