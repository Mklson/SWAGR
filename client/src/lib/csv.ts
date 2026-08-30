export interface CsvData {
  headers: string[];
  rader: string[][];
}

/** Enkel CSV-parser med støtte for anførselstegn og auto-gjenkjenning av
 * skilletegn (komma eller semikolon - norske Excel-eksporter bruker ofte
 * semikolon siden komma er desimaltegn). God nok for kundeeksport-filer. */
export function parseCsv(tekst: string): CsvData {
  const linjer = tekst.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (linjer.length === 0) return { headers: [], rader: [] };

  const skilletegn = linjer[0].split(";").length > linjer[0].split(",").length ? ";" : ",";

  function parseLinje(linje: string): string[] {
    const felter: string[] = [];
    let felt = "";
    let inneIAnfoerselstegn = false;
    for (let i = 0; i < linje.length; i++) {
      const tegn = linje[i];
      if (tegn === '"') {
        if (inneIAnfoerselstegn && linje[i + 1] === '"') {
          felt += '"';
          i++;
        } else {
          inneIAnfoerselstegn = !inneIAnfoerselstegn;
        }
      } else if (tegn === skilletegn && !inneIAnfoerselstegn) {
        felter.push(felt.trim());
        felt = "";
      } else {
        felt += tegn;
      }
    }
    felter.push(felt.trim());
    return felter;
  }

  const headers = parseLinje(linjer[0]);
  const rader = linjer.slice(1).map(parseLinje);
  return { headers, rader };
}

/** Gjetter hvilken kolonne som mest sannsynlig er navn/referanse basert på
 * vanlige kolonnenavn i norske og engelske kundeeksporter. */
export function gjettKolonne(headers: string[], kandidater: string[]): number | null {
  const lav = headers.map((h) => h.toLowerCase());
  for (const kandidat of kandidater) {
    const idx = lav.findIndex((h) => h.includes(kandidat));
    if (idx !== -1) return idx;
  }
  return null;
}
