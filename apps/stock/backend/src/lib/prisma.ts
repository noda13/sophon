import { PrismaClient } from '../generated/prisma/index.js';

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

// Lazy so importing this module (e.g. in tests) does not open a DB connection.
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getClient();
    return Reflect.get(instance, prop, instance);
  },
});

export default prisma;
