import { prisma } from "../db/client.js";
import { BEVEGELSE_FORTEGN } from "./bevegelseFortegn.js";

interface Periode {
  fra?: Date;
  til?: Date;
}

function periodeWhere({ fra, til }: Periode) {
  if (!fra && !til) return {};
  return {
    tidspunkt: {
      ...(fra ? { gte: fra } : {}),
      ...(til ? { lte: til } : {}),
    },
  };
}

/** Summerer aktive reservasjoner per variant+lokasjon (nøkkel: "variantId:lokasjonId"). */
async function hentReservertKart(filter: { variantId?: string; lokasjonId?: string }) {
  const reservasjoner = await prisma.reservasjon.findMany({
    where: {
      status: "aktiv",
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.lokasjonId ? { lokasjonId: filter.lokasjonId } : {}),
    },
    select: { variantId: true, lokasjonId: true, antall: true },
  });
  const kart = new Map<string, number>();
  for (const r of reservasjoner) {
    const key = `${r.variantId}:${r.lokasjonId}`;
    kart.set(key, (kart.get(key) ?? 0) + r.antall);
  }
  return kart;
}

export async function beregnBeholdning(filter: { variantId?: string; lokasjonId?: string }) {
  const [bevegelser, reservertKart] = await Promise.all([
    prisma.bevegelse.findMany({
      where: {
        ...(filter.variantId ? { variantId: filter.variantId } : {}),
        ...(filter.lokasjonId ? { lokasjonId: filter.lokasjonId } : {}),
      },
      select: { variantId: true, lokasjonId: true, type: true, antall: true },
    }),
    hentReservertKart(filter),
  ]);

  const totals = new Map<string, { variantId: string; lokasjonId: string; beholdning: number }>();
  for (const b of bevegelser) {
    const key = `${b.variantId}:${b.lokasjonId}`;
    const existing = totals.get(key) ?? {
      variantId: b.variantId,
      lokasjonId: b.lokasjonId,
      beholdning: 0,
    };
    existing.beholdning += BEVEGELSE_FORTEGN[b.type] * b.antall;
    totals.set(key, existing);
  }

  return Array.from(totals.values()).map((rad) => {
    const reservert = reservertKart.get(`${rad.variantId}:${rad.lokasjonId}`) ?? 0;
    return { ...rad, reservert, tilgjengelig: rad.beholdning - reservert };
  });
}

/** Fysisk beholdning og reservert antall for ett variant+lokasjon-par - brukt til å
 * validere at en bevegelse eller reservasjon ikke spiser av andres reserverte antall. */
export async function beregnTilgjengelighet(variantId: string, lokasjonId: string) {
  const [bevegelseSum, reservertSum] = await Promise.all([
    prisma.bevegelse.findMany({
      where: { variantId, lokasjonId },
      select: { type: true, antall: true },
    }),
    prisma.reservasjon.aggregate({
      where: { variantId, lokasjonId, status: "aktiv" },
      _sum: { antall: true },
    }),
  ]);
  const beholdning = bevegelseSum.reduce((sum, b) => sum + BEVEGELSE_FORTEGN[b.type] * b.antall, 0);
  const reservert = reservertSum._sum.antall ?? 0;
  return { beholdning, reservert, tilgjengelig: beholdning - reservert };
}

export async function beregnRapportKontekst(
  kontekstId: string,
  filter: { variantId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      kontekstId,
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...periodeWhere(filter),
    },
    select: { variantId: true, type: true, antall: true, verdiOre: true },
  });

  interface Rad {
    variantId: string;
    type: string;
    antall: number;
    verdiOre: number;
    // Hvor mange av bevegelsene i denne gruppen som faktisk hadde en
    // registrert pris - så verdiOre kan vises som et delvis/ukomplett tall
    // når eldre bevegelser mangler pris, i stedet for å late som 0 er sant.
    antallMedVerdi: number;
  }
  const totals = new Map<string, Rad>();
  for (const b of bevegelser) {
    const key = `${b.variantId}:${b.type}`;
    const existing = totals.get(key) ?? {
      variantId: b.variantId,
      type: b.type,
      antall: 0,
      verdiOre: 0,
      antallMedVerdi: 0,
    };
    existing.antall += b.antall;
    if (b.verdiOre !== null) {
      existing.verdiOre += b.verdiOre * b.antall;
      existing.antallMedVerdi += b.antall;
    }
    totals.set(key, existing);
  }
  return Array.from(totals.values());
}

/** Fleksibel rapport: kontekst og/eller merke er valgfrie filtre. Summerer
 * alltid per (kontekstId, merkeId, type) - klienten avgjør hvordan resultatet
 * vises ut fra hvilke filtre som faktisk ble satt (f.eks. ett merke uten
 * kontekst -> vis nedbrutt per kunde; én kontekst uten merke -> vis nedbrutt
 * per merke; ingen av delene -> vis alt). Løser "verdi for merke X på tvers
 * av alle kunder" / "verdi for kunde Y på tvers av alle merker" uten å måtte
 * velge én av dem på forhånd slik de andre rapportene krever. */
export async function beregnRapportFleksibel(
  filter: { kontekstId?: string; merkeId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      ...(filter.kontekstId ? { kontekstId: filter.kontekstId } : {}),
      ...(filter.merkeId ? { variant: { merkeId: filter.merkeId } } : {}),
      ...periodeWhere(filter),
    },
    select: {
      kontekstId: true,
      type: true,
      antall: true,
      verdiOre: true,
      variant: { select: { merkeId: true } },
    },
  });

  interface Rad {
    kontekstId: string | null;
    merkeId: string | null;
    type: string;
    antall: number;
    verdiOre: number;
    antallMedVerdi: number;
  }
  const totals = new Map<string, Rad>();
  for (const b of bevegelser) {
    const merkeId = b.variant.merkeId;
    const key = `${b.kontekstId}:${merkeId ?? "null"}:${b.type}`;
    const existing = totals.get(key) ?? {
      kontekstId: b.kontekstId,
      merkeId,
      type: b.type,
      antall: 0,
      verdiOre: 0,
      antallMedVerdi: 0,
    };
    existing.antall += b.antall;
    if (b.verdiOre !== null) {
      existing.verdiOre += b.verdiOre * b.antall;
      existing.antallMedVerdi += b.antall;
    }
    totals.set(key, existing);
  }
  return Array.from(totals.values());
}

export async function beregnRapportPeriode(
  filter: { variantId?: string; lokasjonId?: string; kontekstId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.lokasjonId ? { lokasjonId: filter.lokasjonId } : {}),
      ...(filter.kontekstId ? { kontekstId: filter.kontekstId } : {}),
      ...periodeWhere(filter),
    },
    select: { type: true, antall: true, verdiOre: true },
  });

  interface Rad {
    type: string;
    antall: number;
    verdiOre: number;
    antallMedVerdi: number;
  }
  const totals = new Map<string, Rad>();
  for (const b of bevegelser) {
    const existing = totals.get(b.type) ?? { type: b.type, antall: 0, verdiOre: 0, antallMedVerdi: 0 };
    existing.antall += b.antall;
    if (b.verdiOre !== null) {
      existing.verdiOre += b.verdiOre * b.antall;
      existing.antallMedVerdi += b.antall;
    }
    totals.set(b.type, existing);
  }
  return Array.from(totals.values());
}
