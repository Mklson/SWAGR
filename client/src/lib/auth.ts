// Innloggingstilstand for klienten: token, bruker, og hvilke bedrifter
// brukeren er medlem av + hvilken som er aktiv. Lagres via lagring.ts
// (window.localStorage) - fungerer på web-target.
import type { Bedrift, InnloggetBruker } from "../types";
import { fjernLagretVerdi, hentLagretVerdi, lagreVerdi } from "./lagring";

const TOKEN_NOKKEL = "swagr_token";
const BRUKER_NOKKEL = "swagr_bruker";
const BEDRIFTER_NOKKEL = "swagr_bedrifter";
const AKTIV_BEDRIFT_NOKKEL = "swagr_aktiv_bedrift";

function lesJson<T>(nokkel: string): T | null {
  const raa = hentLagretVerdi(nokkel);
  if (!raa) return null;
  try {
    return JSON.parse(raa) as T;
  } catch {
    return null;
  }
}

let token: string | null = hentLagretVerdi(TOKEN_NOKKEL);
let bruker: InnloggetBruker | null = lesJson<InnloggetBruker>(BRUKER_NOKKEL);
let bedrifter: Bedrift[] = lesJson<Bedrift[]>(BEDRIFTER_NOKKEL) ?? [];
let aktivBedriftId: string | null = hentLagretVerdi(AKTIV_BEDRIFT_NOKKEL);
let lyttere: Array<() => void> = [];

export function hentToken(): string | null {
  return token;
}

export function erInnlogget(): boolean {
  return token != null;
}

export function hentLagretBruker(): InnloggetBruker | null {
  return bruker;
}

export function hentBedrifter(): Bedrift[] {
  return bedrifter;
}

export function hentBedriftId(): string | null {
  return aktivBedriftId;
}

export function hentAktivBedrift(): Bedrift | null {
  return bedrifter.find((b) => b.id === aktivBedriftId) ?? bedrifter[0] ?? null;
}

/** Rollen brukeren har i den aktive bedriften. */
export function hentAktivRolle(): string | null {
  return hentAktivBedrift()?.rolle ?? null;
}

export function settOkt(nyToken: string, nyBruker: InnloggetBruker, nyeBedrifter: Bedrift[]): void {
  token = nyToken;
  bruker = nyBruker;
  bedrifter = nyeBedrifter;
  // Behold aktiv bedrift hvis den fortsatt er gyldig, ellers første.
  if (!nyeBedrifter.some((b) => b.id === aktivBedriftId)) {
    aktivBedriftId = nyeBedrifter[0]?.id ?? null;
  }
  lagreVerdi(TOKEN_NOKKEL, nyToken);
  lagreVerdi(BRUKER_NOKKEL, JSON.stringify(nyBruker));
  lagreVerdi(BEDRIFTER_NOKKEL, JSON.stringify(nyeBedrifter));
  if (aktivBedriftId) lagreVerdi(AKTIV_BEDRIFT_NOKKEL, aktivBedriftId);
  varsle();
}

/** Oppdater bedriftslista (f.eks. etter endret logo) uten å røre token. */
export function settBedrifter(nyeBedrifter: Bedrift[]): void {
  bedrifter = nyeBedrifter;
  lagreVerdi(BEDRIFTER_NOKKEL, JSON.stringify(nyeBedrifter));
  if (!nyeBedrifter.some((b) => b.id === aktivBedriftId)) {
    aktivBedriftId = nyeBedrifter[0]?.id ?? null;
    if (aktivBedriftId) lagreVerdi(AKTIV_BEDRIFT_NOKKEL, aktivBedriftId);
  }
  varsle();
}

export function settAktivBedrift(id: string): void {
  if (!bedrifter.some((b) => b.id === id) || id === aktivBedriftId) return;
  aktivBedriftId = id;
  lagreVerdi(AKTIV_BEDRIFT_NOKKEL, id);
  varsle();
}

export function loggUt(): void {
  token = null;
  bruker = null;
  bedrifter = [];
  aktivBedriftId = null;
  fjernLagretVerdi(TOKEN_NOKKEL);
  fjernLagretVerdi(BRUKER_NOKKEL);
  fjernLagretVerdi(BEDRIFTER_NOKKEL);
  fjernLagretVerdi(AKTIV_BEDRIFT_NOKKEL);
  varsle();
}

/** Abonner på endringer i innloggings-/bedriftstilstand. Returnerer avmelding. */
export function abonner(fn: () => void): () => void {
  lyttere.push(fn);
  return () => {
    lyttere = lyttere.filter((l) => l !== fn);
  };
}

function varsle(): void {
  for (const l of lyttere) l();
}
