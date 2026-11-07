import prisma from '../src/lib/prisma.js';

export async function resetDb() {
  await prisma.screeningSnapshot.deleteMany();
  await prisma.dailyPrice.deleteMany();
  await prisma.financialStatement.deleteMany();
  await prisma.collectionLog.deleteMany();
  await prisma.stock.deleteMany();
}
