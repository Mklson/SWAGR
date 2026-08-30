import { prisma } from "../db/client.js";

export async function sokKontekst(navn: string) {
  return prisma.kontekst.findMany({
    where: { navn: { contains: navn, mode: "insensitive" } },
    take: 10,
  });
}

export async function sokVariant(navnEllerSku: string) {
  return prisma.variant.findMany({
    where: {
      OR: [
        { sku: { contains: navnEllerSku, mode: "insensitive" } },
        { vare: { navn: { contains: navnEllerSku, mode: "insensitive" } } },
      ],
    },
    include: { vare: true },
    take: 10,
  });
}

export async function sokLokasjon(navn: string) {
  return prisma.lokasjon.findMany({
    where: { navn: { contains: navn, mode: "insensitive" } },
    take: 10,
  });
}
