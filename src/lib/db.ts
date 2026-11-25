import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaReadyPromise: Promise<void> | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Ensures additive columns added after initial deployment exist in PostgreSQL
 * even if `prisma db push` has not been run manually yet. Never drops or alters existing data.
 */
export async function ensureSchemaReady(): Promise<void> {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) return

  if (!globalForPrisma.schemaReadyPromise) {
    globalForPrisma.schemaReadyPromise = (async () => {
      try {
        const cols = await db.$queryRaw<Array<{ table_name: string; column_name: string }>>`
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('User', 'Sheet')
        `
        const has = (table: string, col: string) =>
          cols.some((c) => c.table_name === table && c.column_name === col)

        if (!has('User', 'leetcodeUsername')) {
          await db.$executeRawUnsafe(
            'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "leetcodeUsername" TEXT'
          )
        }
        if (!has('User', 'leetcodeLastSyncedAt')) {
          await db.$executeRawUnsafe(
            'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "leetcodeLastSyncedAt" TIMESTAMP(3)'
          )
        }
        if (!has('Sheet', 'syncWithGlobal')) {
          await db.$executeRawUnsafe(
            'ALTER TABLE "Sheet" ADD COLUMN IF NOT EXISTS "syncWithGlobal" BOOLEAN NOT NULL DEFAULT true'
          )
        }
      } catch (err) {
        // Reset promise so next request can retry if DB had a transient error
        globalForPrisma.schemaReadyPromise = undefined
        console.error('[ensureSchemaReady] failed:', err)
      }
    })()
  }

  await globalForPrisma.schemaReadyPromise
}