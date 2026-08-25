import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Standard "singleton across hot reloads" pattern so tsx watch / test runners
// don't open a new pool of Postgres connections on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
