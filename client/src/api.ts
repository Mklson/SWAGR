import { API_BASE_URL } from "./config";
import { hentBedriftId, hentToken, loggUt } from "./lib/auth";
import type {
  Bedrift,
  BeholdningRad,
  Bevegelse,
  BevegelseType,
  Bruker,
  Formaal,
  InnloggetBruker,
  Kontekst,
  KontekstType,
  Leverandor,
  Lokasjon,
  Merke,
  RapportFleksibelRad,
  RapportInngaendeRad,
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
  const bedriftId = hentBedriftId();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(harBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(bedriftId ? { "x-bedrift-id": bedriftId } : {}),
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

function del(path: string): Promise<unknown> {
  return forespørsel<unknown>(path, { method: "DELETE" });
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
  bruker: InnloggetBruker;
  bedrifter: Bedrift[];
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

export interface MegSvar {
  bruker: InnloggetBruker;
  bedrifter: Bedrift[];
  aktivBedriftId: string;
}

export const hentMeg = () => forespørsel<MegSvar>("/api/auth/meg");

export const oppdaterBedrift = (data: { navn?: string; logoUrl?: string | null }) =>
  patch<{ id: string; navn: string; logoUrl: string | null }>("/api/bedrift", data);

export const listLeverandorer = () => list<Leverandor>("/api/leverandorer");
export const opprettLeverandor = (data: { navn: string }) =>
  create<Leverandor>("/api/leverandorer", data);
export const oppdaterLeverandor = (id: string, data: { navn?: string }) =>
  patch<Leverandor>(`/api/leverandorer/${id}`, data);
export const slettLeverandor = (id: string) => del(`/api/leverandorer/${id}`);

export const listVarer = () => list<Vare>("/api/varer");
export const opprettVare = (data: { navn: string; kategori: string; leverandorId: string }) =>
  create<Vare>("/api/varer", data);
export const oppdaterVare = (
  id: string,
  data: Partial<{ navn: string; kategori: string; leverandorId: string }>,
) => patch<Vare>(`/api/varer/${id}`, data);
export const slettVare = (id: string) => del(`/api/varer/${id}`);

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
export const slettVariant = (id: string) => del(`/api/varianter/${id}`);

export const listMerker = () => list<Merke>("/api/merker");
export const opprettMerke = (data: { navn: string; logoUrl?: string }) =>
  create<Merke>("/api/merker", data);
export const oppdaterMerke = (id: string, data: { navn?: string; logoUrl?: string | null }) =>
  patch<Merke>(`/api/merker/${id}`, data);
export const slettMerke = (id: string) => del(`/api/merker/${id}`);

export const listLokasjoner = () => list<Lokasjon>("/api/lokasjoner");
export const opprettLokasjon = (data: { navn: string; type: string }) =>
  create<Lokasjon>("/api/lokasjoner", data);
export const oppdaterLokasjon = (id: string, data: { navn?: string; type?: string }) =>
  patch<Lokasjon>(`/api/lokasjoner/${id}`, data);
export const slettLokasjon = (id: string) => del(`/api/lokasjoner/${id}`);

export interface KundeKontaktFelter {
  firma?: string | null;
  kontaktperson?: string | null;
  adresse?: string | null;
  epost?: string | null;
  telefon?: string | null;
}

export const listKontekster = () => list<Kontekst>("/api/kontekster");
export const opprettKontekst = (
  data: { type: KontekstType; navn: string; referanse?: string } & KundeKontaktFelter,
) => create<Kontekst>("/api/kontekster", data);
export const oppdaterKontekst = (
  id: string,
  data: { navn?: string; referanse?: string | null } & KundeKontaktFelter,
) => patch<Kontekst>(`/api/kontekster/${id}`, data);
export const slettKontekst = (id: string) => del(`/api/kontekster/${id}`);

export const listFormaal = () => list<Formaal>("/api/formaal");
export const opprettFormaal = (data: { navn: string }) => create<Formaal>("/api/formaal", data);
export const oppdaterFormaal = (id: string, data: { navn?: string }) =>
  patch<Formaal>(`/api/formaal/${id}`, data);
export const slettFormaal = (id: string) => del(`/api/formaal/${id}`);

export const listBrukere = () => list<Bruker>("/api/brukere");
export const opprettBruker = (data: { navn: string; rolle: string }) =>
  create<Bruker>("/api/brukere", data);
export const oppdaterBruker = (id: string, data: { navn?: string; rolle?: string }) =>
  patch<Bruker>(`/api/brukere/${id}`, data);
export const slettBruker = (id: string) => del(`/api/brukere/${id}`);

export const listBevegelser = (query?: { variantId?: string; lokasjonId?: string; kontekstId?: string }) =>
  list<Bevegelse>(`/api/bevegelser${byggSpørrestreng(query ?? {})}`);
export const opprettBevegelse = (data: {
  variantId: string;
  lokasjonId: string;
  kontekstId?: string;
  formaalId?: string;
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
  kontekstId?: string;
  formaalId?: string;
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

export const hentRapportInngaende = (query: {
  lokasjonId?: string;
  merkeId?: string;
  leverandorId?: string;
  fra?: string;
  til?: string;
}) => list<RapportInngaendeRad>(`/api/rapporter/inngaende${byggSpørrestreng(query)}`);
