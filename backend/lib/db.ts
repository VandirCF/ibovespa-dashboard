import { PrismaClient } from '@prisma/client'

/**
 * Cliente Prisma compartilhado pelo backend (uma instância por processo).
 */
export const prisma = new PrismaClient({ log: ['warn', 'error'] })
