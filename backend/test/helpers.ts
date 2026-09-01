import { PrismaClient } from "@prisma/client";
import { STANDARD_BEDRIFT_ID, STANDARD_BEDRIFT_NAVN } from "../src/db/systemdata.js";

export const testPrisma = new PrismaClient();
export { STANDARD_BEDRIFT_ID };

export async function resetDb() {
  await testPrisma.reservasjon.deleteMany();
  await testPrisma.bevegelse.deleteMany();
  await testPrisma.variant.deleteMany();
  await testPrisma.merke.deleteMany();
  await testPrisma.vare.deleteMany();
  await testPrisma.formaal.deleteMany();
  await testPrisma.kontekst.deleteMany();
  await testPrisma.leverandor.deleteMany();
  await testPrisma.lokasjon.deleteMany();
  await testPrisma.invitertEpost.deleteMany();
  await testPrisma.brukerBedrift.deleteMany();
  await testPrisma.bruker.deleteMany();
  await testPrisma.bedrift.deleteMany();
  // Standardbedriften som tester (krevAuth: false) og backfyll bruker.
  await testPrisma.bedrift.create({
    data: { id: STANDARD_BEDRIFT_ID, navn: STANDARD_BEDRIFT_NAVN },
  });
}
