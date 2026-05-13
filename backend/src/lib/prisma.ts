import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | undefined;

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) _prisma = new PrismaClient();
    return (_prisma as any)[prop];
  },
});

export default prisma;
