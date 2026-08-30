// Eksport til CSV i stedet for ekte .xlsx - unngår xlsx-biblioteket (npm sin
// versjon har et høy-alvorlighetsgrad sikkerhetsfunn uten tilgjengelig fiks;
// SheetJS sin patchede versjon finnes kun på deres egen CDN, ikke npm).
// Excel åpner CSV direkte. Semikolon som skilletegn og komma som desimaltegn
// matcher norsk Excel-standard (komma er tallenes desimaltegn her, så komma
// kan ikke også være kolonneskille).

function celle(verdi: string | number): string {
  const tekst = String(verdi);
  return tekst.includes(";") || tekst.includes('"') || tekst.includes("\n")
    ? `"${tekst.replace(/"/g, '""')}"`
    : tekst;
}

export function eksporterCsv(filnavn: string, headers: string[], rader: (string | number)[][]) {
  if (typeof document === "undefined") return;

  const linjer = [headers, ...rader].map((rad) => rad.map(celle).join(";"));
  // ﻿ (BOM) sikrer at Excel tolker æøå riktig i UTF-8-filer.
  const innhold = "﻿" + linjer.join("\r\n");
  const blob = new Blob([innhold], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const lenke = document.createElement("a");
  lenke.href = url;
  lenke.download = filnavn.endsWith(".csv") ? filnavn : `${filnavn}.csv`;
  document.body.appendChild(lenke);
  lenke.click();
  document.body.removeChild(lenke);
  URL.revokeObjectURL(url);
}
