// Enkel per-enhet lagring for å huske siste valgt bruker etc. mellom økter.
// Bruker kun window.localStorage (tilgjengelig på web-target) - ingen ny
// native-avhengighet (unngår versjonsrisiko med Expo 57, se client/AGENTS.md).
// No-op på native uten localStorage: funksjonene faller da bare tilbake til
// ingen forhåndsutfylling, appen fungerer likevel.

export function hentLagretVerdi(nokkel: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(nokkel);
  } catch {
    return null;
  }
}

export function lagreVerdi(nokkel: string, verdi: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(nokkel, verdi);
  } catch {
    // ignorer - kun en bekvemmelighet
  }
}

export function fjernLagretVerdi(nokkel: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(nokkel);
  } catch {
    // ignorer
  }
}
