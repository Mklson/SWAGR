import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function resetDb() {
  await testPrisma.reservasjon.deleteMany();
  await testPrisma.bevegelse.deleteMany();
  await testPrisma.variant.deleteMany();
  await testPrisma.merke.deleteMany();
  await testPrisma.vare.deleteMany();
  await testPrisma.kontekst.deleteMany();
  await testPrisma.invitertEpost.deleteMany();
  await testPrisma.bruker.deleteMany();
  await testPrisma.lokasjon.deleteMany();
  await testPrisma.leverandor.deleteMany();
}
