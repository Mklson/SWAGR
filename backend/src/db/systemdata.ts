import { KontekstType } from "@prisma/client";
import { prisma } from "./client.js";

// Fast id for standardbedriften (satt i migrasjon 20260831140000_legg_til_bedrift).
// Brukes som fallback-bedrift i tester (krevAuth: false) og backfyll.
export const STANDARD_BEDRIFT_ID = "b7a11d00-0000-4000-8000-000000000001";
export const STANDARD_BEDRIFT_NAVN = "Brand Partners";

const SYSTEM_KONTEKSTER: { type: KontekstType; navn: string }[] = [
  { type: "innkjop", navn: "Varemottak" },
  { type: "svinn", navn: "Svinn" },
  { type: "internbruk", navn: "Internbruk" },
  { type: "retur", navn: "Retur" },
];

/**
 * Sørger for at standardbedriften finnes, og at hver bedrift har sine skjulte
 * system-kontekster (varemottak/svinn/internbruk/retur). Kalt ved oppstart.
 * Idempotent.
 */
export async function ensureSystemData(): Promise<void> {
  await prisma.bedrift.upsert({
    where: { id: STANDARD_BEDRIFT_ID },
    update: {},
    create: { id: STANDARD_BEDRIFT_ID, navn: STANDARD_BEDRIFT_NAVN },
  });

  const bedrifter = await prisma.bedrift.findMany({ select: { id: true } });
  for (const { id: bedriftId } of bedrifter) {
    for (const { type, navn } of SYSTEM_KONTEKSTER) {
      const finnes = await prisma.kontekst.findFirst({ where: { bedriftId, type } });
      if (!finnes) await prisma.kontekst.create({ data: { bedriftId, type, navn } });
    }
  }
}
