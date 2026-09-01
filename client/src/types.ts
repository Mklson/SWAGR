export interface VariantKandidat {
  id: string;
  navn: string;
  sku: string;
  attributter: unknown;
}

export interface VariantGjenkjenningResultat {
  varetype: string;
  beskrivelse: string;
  synligSku: string | null;
  variantId: string | null;
  kandidater: VariantKandidat[];
  nyVariant: boolean;
}

export interface Leverandor {
  id: string;
  navn: string;
}

export interface Vare {
  id: string;
  navn: string;
  kategori: string;
  leverandorId: string;
}

export interface Merke {
  id: string;
  navn: string;
  logoUrl: string | null;
}

export interface Variant {
  id: string;
  vareId: string;
  attributter: Record<string, unknown>;
  sku: string;
  bildeurl: string | null;
  merkeId: string | null;
  verdiOre: number | null;
}

export interface Lokasjon {
  id: string;
  navn: string;
  type: string;
}

export type KontekstType = "kunde" | "prosjekt" | "internbruk" | "svinn" | "retur" | "innkjop";

export interface Kontekst {
  id: string;
  type: KontekstType;
  navn: string;
  referanse: string | null;
}

export interface Formaal {
  id: string;
  navn: string;
}

export interface Bruker {
  id: string;
  navn: string;
  rolle: string;
  epost?: string | null;
}

export interface Bedrift {
  id: string;
  navn: string;
  logoUrl?: string | null;
  rolle: string;
}

export interface InnloggetBruker {
  id: string;
  navn: string;
  epost: string | null;
}

export type BevegelseType = "inn" | "ut" | "svinn" | "retur" | "internbruk";

export interface Bevegelse {
  id: string;
  variantId: string;
  lokasjonId: string;
  kontekstId: string | null;
  formaalId: string | null;
  brukerId: string;
  type: BevegelseType;
  antall: number;
  verdiOre: number | null;
  tidspunkt: string;
}

export interface BeholdningRad {
  variantId: string;
  lokasjonId: string;
  beholdning: number;
  reservert: number;
  tilgjengelig: number;
}

export type ReservasjonStatus = "aktiv" | "kansellert" | "fullfort";

export interface Reservasjon {
  id: string;
  variantId: string;
  lokasjonId: string;
  kontekstId: string | null;
  formaalId: string | null;
  brukerId: string;
  antall: number;
  status: ReservasjonStatus;
  tilDato: string | null;
  opprettet: string;
}

export interface RapportPeriodeRad {
  type: BevegelseType;
  antall: number;
  verdiOre: number;
  antallMedVerdi: number;
}

export interface RapportKontekstRad {
  variantId: string;
  type: BevegelseType;
  antall: number;
  verdiOre: number;
  antallMedVerdi: number;
}

export interface RapportFleksibelRad {
  kontekstId: string;
  merkeId: string | null;
  type: BevegelseType;
  antall: number;
  verdiOre: number;
  antallMedVerdi: number;
}
