// Innloggingstilstand for klienten. Token og bruker lagres via lagring.ts
// (window.localStorage) - fungerer pa web-target. Pa native uten localStorage
// blir okten ikke husket mellom omstarter, men appen fungerer ellers.
import type { Bruker } from "../types";
import { fjernLagretVerdi, hentLagretVerdi, lagreVerdi } from "./lagring";

const TOKEN_NOKKEL = "swagr_token";
const BRUKER_NOKKEL = "swagr_bruker";

let token: string | null = hentLagretVerdi(TOKEN_NOKKEL);
let lyttere: Array<() => void> = [];

export function hentToken(): string | null {
  return token;
}

export function erInnlogget(): boolean {
  return token != null;
}

export function hentLagretBruker(): Bruker | null {
  const raa = hentLagretVerdi(BRUKER_NOKKEL);
  if (!raa) return null;
  try {
    return JSON.parse(raa) as Bruker;
  } catch {
    return null;
  }
}

export function settOkt(nyToken: string, bruker: Bruker): void {
  token = nyToken;
  lagreVerdi(TOKEN_NOKKEL, nyToken);
  lagreVerdi(BRUKER_NOKKEL, JSON.stringify(bruker));
  varsle();
}

export function loggUt(): void {
  token = null;
  fjernLagretVerdi(TOKEN_NOKKEL);
  fjernLagretVerdi(BRUKER_NOKKEL);
  varsle();
}

/** Abonner pa endringer i innloggingstilstand. Returnerer en avmeldingsfunksjon. */
export function abonner(fn: () => void): () => void {
  lyttere.push(fn);
  return () => {
    lyttere = lyttere.filter((l) => l !== fn);
  };
}

function varsle(): void {
  for (const l of lyttere) l();
}
