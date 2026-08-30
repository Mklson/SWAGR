import { API_BASE_URL } from "./config";
import { hentToken, loggUt } from "./lib/auth";
import type {
  BeholdningRad,
  Bevegelse,
  BevegelseType,
  Bruker,
  Kontekst,
  KontekstType,
  Leverandor,
  Lokasjon,
  Merke,
  RapportFleksibelRad,
  RapportKontekstRad,
  RapportPeriodeRad,
  Reservasjon,
  ReservasjonStatus,
  Vare,
  Variant,
  VariantGjenkjenningResultat,
} from "./types";

export class ApiFeil extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiFeil";
  }
}

async function forespørsel<T>(path: string, init?: RequestInit): Promise<T> {
  // Fastify avviser en forespørsel med Content-Type: application/json og tom
  // body (FST_ERR_CTP_EMPTY_JSON_BODY) - kun sett headeren når det faktisk
  // sendes en body (kanseller/fullfor har ingen).
  const harBody = init?.body !== undefined;
  const token = hentToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(harBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Utløpt/ugyldig token mens vi var innlogget: logg ut sa appen viser
    // innloggingsskjermen igjen. (Ikke ved selve innloggingskallet.)
    if (response.status === 401 && token) loggUt();
    const melding =
      typeof body?.error === "string" ? body.error : "Ukjent feil fra serveren";
    throw new ApiFeil(response.status, melding);
  }
  return body as T;
}

function list<T>(path: string): Promise<T[]> {
  return forespørsel<T[]>(path);
}

function create<T>(path: string, data: unknown): Promise<T> {
  return forespørsel<T>(path, { method: "POST", body: JSON.stringify(data) });
}

function patch<T>(path: string, data: unknown): Promise<T> {
  return forespørsel<T>(path, { method: "PATCH", body: JSON.stringify(data) });
}

function byggSpørrestreng(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [nøkkel, verdi] of Object.entries(query)) {
    if (verdi) params.set(nøkkel, verdi);
  }
  const streng = params.toString();
  return streng ? `?${streng}` : "";
}

export function gjenkjennVariant(
  base64Bilde: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<VariantGjenkjenningResultat> {
  return create("/api/varianter/gjenkjenn", { fil: base64Bilde, mediaType });
}

export interface BildeOpplastingSvar {
  url: string;
}

/** Laster opp et (allerede komprimert) JPEG-bilde som bar base64, får en offentlig URL. */
export const lastOppBilde = (base64: string) =>
  create<BildeOpplastingSvar>("/api/bilder", { fil: base64, mediaType: "image/jpeg" });

// --- Auth ---

export interface InnloggingSvar {
  token: string;
  bruker: Bruker;
}

export const loggInn = (epost: string, passord: string) =>
  forespørsel<InnloggingSvar>("/api/auth/logg-inn", {
    method: "POST",
    body: JSON.stringify({ epost, passord }),
  });

export const registrer = (epost: string, passord: string, navn: string) =>
  forespørsel<InnloggingSvar>("/api/auth/registrer", {
    method: "POST",
    body: JSON.stringify({ epost, passord, navn }),
  });

export const hentMeg = () => forespørsel<Bruker>("/api/auth/meg");

export const listLeverandorer = () => list<Leverandor>("/api/leverandorer");
export const opprettLeverandor = (data: { navn: string }) =>
  create<Leverandor>("/api/leverandorer", data);

export const listVarer = () => list<Vare>("/api/varer");
export const opprettVare = (data: { navn: string; kategori: string; leverandorId: string }) =>
  create<Vare>("/api/varer", data);

export const listVarianter = () => list<Variant>("/api/varianter");
export const opprettVariant = (data: {
  vareId: string;
  sku: string;
  attributter?: Record<string, unknown>;
  bildeurl?: string;
  merkeId?: string;
  verdiOre?: number;
}) => create<Variant>("/api/varianter", data);
export const oppdaterVariant = (
  id: string,
  data: Partial<{ bildeurl: string | null; merkeId: string | null; verdiOre: number | null }>,
) => patch<Variant>(`/api/varianter/${id}`, data);

export const listMerker = () => list<Merke>("/api/merker");
export const opprettMerke = (data: { navn: string; logoUrl?: string }) =>
  create<Merke>("/api/merker", data);

export const listLokasjoner = () => list<Lokasjon>("/api/lokasjoner");
export const opprettLokasjon = (data: { navn: string; type: string }) =>
  create<Lokasjon>("/api/lokasjoner", data);

export const listKontekster = () => list<Kontekst>("/api/kontekster");
export const opprettKontekst = (data: { type: KontekstType; navn: string; referanse?: string }) =>
  create<Kontekst>("/api/kontekster", data);

export const listBrukere = () => list<Bruker>("/api/brukere");
export const opprettBruker = (data: { navn: string; rolle: string }) =>
  create<Bruker>("/api/brukere", data);

export const listBevegelser = (query?: { variantId?: string; lokasjonId?: string; kontekstId?: string }) =>
  list<Bevegelse>(`/api/bevegelser${byggSpørrestreng(query ?? {})}`);
export const opprettBevegelse = (data: {
  variantId: string;
  lokasjonId: string;
  kontekstId: string;
  brukerId: string;
  type: BevegelseType;
  antall: number;
}) => create<Bevegelse>("/api/bevegelser", data);

export const hentBeholdning = () => list<BeholdningRad>("/api/beholdning");

export const listReservasjoner = (status?: ReservasjonStatus) =>
  list<Reservasjon>(`/api/reservasjoner${byggSpørrestreng({ status })}`);
export const opprettReservasjon = (data: {
  variantId: string;
  lokasjonId: string;
  kontekstId: string;
  brukerId: string;
  antall: number;
  tilDato?: string;
}) => create<Reservasjon>("/api/reservasjoner", data);
export const kansellerReservasjon = (id: string) =>
  forespørsel<Reservasjon>(`/api/reservasjoner/${id}/kanseller`, { method: "POST" });
export const fullforReservasjon = (id: string) =>
  forespørsel<Reservasjon>(`/api/reservasjoner/${id}/fullfor`, { method: "POST" });

export const hentRapportPeriode = (query: {
  variantId?: string;
  lokasjonId?: string;
  kontekstId?: string;
  fra?: string;
  til?: string;
}) => list<RapportPeriodeRad>(`/api/rapporter/periode${byggSpørrestreng(query)}`);

export const hentRapportKontekst = (
  kontekstId: string,
  query: { variantId?: string; fra?: string; til?: string },
) => list<RapportKontekstRad>(`/api/rapporter/kontekst/${kontekstId}${byggSpørrestreng(query)}`);

export const hentRapportFleksibel = (query: {
  kontekstId?: string;
  merkeId?: string;
  fra?: string;
  til?: string;
}) => list<RapportFleksibelRad>(`/api/rapporter/fleksibel${byggSpørrestreng(query)}`);
