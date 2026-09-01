import type { BevegelseType } from "@prisma/client";
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
async function hentReservertKart(filter: { bedriftId: string; variantId?: string; lokasjonId?: string }) {
  const reservasjoner = await prisma.reservasjon.findMany({
    where: {
      status: "aktiv",
      bedriftId: filter.bedriftId,
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

export async function beregnBeholdning(filter: {
  bedriftId: string;
  variantId?: string;
  lokasjonId?: string;
}) {
  const [bevegelser, reservertKart] = await Promise.all([
    prisma.bevegelse.findMany({
      where: {
        bedriftId: filter.bedriftId,
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
  filter: { bedriftId: string; variantId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      bedriftId: filter.bedriftId,
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
  filter: { bedriftId: string; kontekstId?: string; merkeId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      bedriftId: filter.bedriftId,
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

/** Inngående varer (varemottak): summerer alle "inn"-bevegelser per variant,
 * filtrerbart på lokasjon, merke, leverandør og periode. Svarer på "hva og hvor
 * mye har vi tatt inn på lager", med kostverdi der den er registrert. */
export async function beregnRapportInngaende(
  filter: {
    bedriftId: string;
    lokasjonId?: string;
    merkeId?: string;
    leverandorId?: string;
  } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      bedriftId: filter.bedriftId,
      type: "inn",
      ...(filter.lokasjonId ? { lokasjonId: filter.lokasjonId } : {}),
      ...(filter.merkeId || filter.leverandorId
        ? {
            variant: {
              ...(filter.merkeId ? { merkeId: filter.merkeId } : {}),
              ...(filter.leverandorId ? { vare: { leverandorId: filter.leverandorId } } : {}),
            },
          }
        : {}),
      ...periodeWhere(filter),
    },
    select: { variantId: true, antall: true, verdiOre: true, tidspunkt: true },
  });

  interface Rad {
    variantId: string;
    antall: number;
    verdiOre: number;
    antallMedVerdi: number;
    sisteInn: Date | null;
  }
  const totals = new Map<string, Rad>();
  for (const b of bevegelser) {
    const rad = totals.get(b.variantId) ?? {
      variantId: b.variantId,
      antall: 0,
      verdiOre: 0,
      antallMedVerdi: 0,
      sisteInn: null,
    };
    rad.antall += b.antall;
    if (b.verdiOre !== null) {
      rad.verdiOre += b.verdiOre * b.antall;
      rad.antallMedVerdi += b.antall;
    }
    if (!rad.sisteInn || b.tidspunkt > rad.sisteInn) rad.sisteInn = b.tidspunkt;
    totals.set(b.variantId, rad);
  }
  return Array.from(totals.values()).sort((a, b) => b.antall - a.antall);
}

/** Egendefinert, linjenivå-rapport: bruker velger fritt ett eller flere av
 * kunder, artikler (vare), bevegelsestyper, lokasjon og periode. Returnerer
 * én rad per bevegelse med alle felt ferdig utpakket - klienten skriver dem
 * rett til hver sin CSV-kolonne. */
export async function beregnRapportDetaljert(
  filter: {
    bedriftId: string;
    kontekstIds?: string[];
    vareIds?: string[];
    typer?: BevegelseType[];
    lokasjonId?: string;
  } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      bedriftId: filter.bedriftId,
      ...(filter.kontekstIds?.length ? { kontekstId: { in: filter.kontekstIds } } : {}),
      ...(filter.typer?.length ? { type: { in: filter.typer } } : {}),
      ...(filter.lokasjonId ? { lokasjonId: filter.lokasjonId } : {}),
      ...(filter.vareIds?.length ? { variant: { vareId: { in: filter.vareIds } } } : {}),
      ...periodeWhere(filter),
    },
    orderBy: { tidspunkt: "desc" },
    select: {
      id: true,
      tidspunkt: true,
      type: true,
      antall: true,
      verdiOre: true,
      variant: {
        select: {
          sku: true,
          vare: { select: { navn: true, kategori: true } },
          merke: { select: { navn: true } },
        },
      },
      lokasjon: { select: { navn: true } },
      kontekst: { select: { navn: true, firma: true } },
      formaal: { select: { navn: true } },
      bruker: { select: { navn: true } },
    },
  });

  return bevegelser.map((b) => ({
    id: b.id,
    tidspunkt: b.tidspunkt,
    type: b.type,
    antall: b.antall,
    verdiOre: b.verdiOre,
    linjeVerdiOre: b.verdiOre != null ? b.verdiOre * b.antall : null,
    artikkel: b.variant.vare.navn,
    kategori: b.variant.vare.kategori,
    sku: b.variant.sku,
    merke: b.variant.merke?.navn ?? null,
    lokasjon: b.lokasjon.navn,
    kunde: b.kontekst?.navn ?? null,
    kundeFirma: b.kontekst?.firma ?? null,
    formaal: b.formaal?.navn ?? null,
    bruker: b.bruker.navn,
  }));
}

export async function beregnRapportPeriode(
  filter: { bedriftId: string; variantId?: string; lokasjonId?: string; kontekstId?: string } & Periode,
) {
  const bevegelser = await prisma.bevegelse.findMany({
    where: {
      bedriftId: filter.bedriftId,
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
