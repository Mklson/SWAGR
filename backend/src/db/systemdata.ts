import { KontekstType } from "@prisma/client";
import { prisma } from "./client.js";

// Skjulte "singleton"-kontekster for uttakstyper uten kunde: varemottak
// (innkjop), svinn, internbruk, retur. Klienten slår dem opp på type og
// bruker dem automatisk, så brukeren aldri må opprette eller velge dem.
const SYSTEM_KONTEKSTER: { type: KontekstType; navn: string }[] = [
  { type: "innkjop", navn: "Varemottak" },
  { type: "svinn", navn: "Svinn" },
  { type: "internbruk", navn: "Internbruk" },
  { type: "retur", navn: "Retur" },
];

/** Oppretter manglende system-kontekster. Kalt ved oppstart. Idempotent. */
export async function ensureSystemData(): Promise<void> {
  for (const { type, navn } of SYSTEM_KONTEKSTER) {
    const finnes = await prisma.kontekst.findFirst({ where: { type } });
    if (!finnes) await prisma.kontekst.create({ data: { type, navn } });
  }
}
