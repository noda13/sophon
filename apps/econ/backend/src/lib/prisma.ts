import { PrismaClient } from '@prisma/client';

// Global singleton to prevent connection pool exhaustion under tsx watch / test reloads.
// In production each process creates exactly one instance (g.prisma is never set).
const g = globalThis as unknown as { prisma?: PrismaClient };

const prisma = g.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma;
}

export default prisma;
