import { prisma } from "../db/client.js";

export async function sokKontekst(bedriftId: string, navn: string) {
  return prisma.kontekst.findMany({
    where: { bedriftId, navn: { contains: navn, mode: "insensitive" } },
    take: 10,
  });
}

export async function sokVariant(bedriftId: string, navnEllerSku: string) {
  return prisma.variant.findMany({
    where: {
      bedriftId,
      OR: [
        { sku: { contains: navnEllerSku, mode: "insensitive" } },
        { vare: { navn: { contains: navnEllerSku, mode: "insensitive" } } },
      ],
    },
    include: { vare: true },
    take: 10,
  });
}

export async function sokLokasjon(bedriftId: string, navn: string) {
  return prisma.lokasjon.findMany({
    where: { bedriftId, navn: { contains: navn, mode: "insensitive" } },
    take: 10,
  });
}
