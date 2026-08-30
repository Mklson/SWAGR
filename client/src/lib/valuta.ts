// Backend lagrer verdi som heltall øre (unngår flyttall-avrundingsfeil på
// beløp) - disse to holder øre/kr-konverteringen på ett sted så resten av
// appen kan jobbe i vanlige kr-strenger som brukeren skriver inn.

export function krTilOre(tekst: string): number | null {
  const normalisert = tekst.trim().replace(",", ".");
  if (!normalisert) return null;
  const kr = Number.parseFloat(normalisert);
  if (Number.isNaN(kr) || kr < 0) return null;
  return Math.round(kr * 100);
}

export function oreTilKrTekst(ore: number | null | undefined): string {
  if (ore === null || ore === undefined) return "";
  return (ore / 100).toFixed(2).replace(".", ",");
}

export function formatterKroner(ore: number | null | undefined): string {
  if (ore === null || ore === undefined) return "—";
  return `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}
