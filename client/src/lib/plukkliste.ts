// Plukkliste-PDF for en fullført Uttak-ordre. Genererer et rent, utskriftsklart
// HTML-dokument og åpner det i en ny fane med utskriftsdialogen - "Lagre som PDF"
// gir en PDF-fil både på PC og mobil, som så kan legges ved i Outlook eller
// sendes som melding. Ingen priser/verdier på lista (den er til plukk).
import { Platform } from "react-native";

export interface PlukklisteLinje {
  navn: string;
  sku: string;
  merke?: string | null;
  antall: number;
}

export interface PlukklisteKunde {
  navn: string;
  firma?: string | null;
  kontaktperson?: string | null;
  adresse?: string | null;
  kundenr?: string | null;
  epost?: string | null;
  telefon?: string | null;
}

export interface PlukklisteData {
  tittel: string;
  ordreDato: string; // ISO
  kunde: PlukklisteKunde | null;
  formaal?: string | null;
  lokasjon: string;
  registrertAv: string;
  linjer: PlukklisteLinje[];
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function radioLinje(label: string, verdi?: string | null): string {
  if (!verdi || !verdi.trim()) return "";
  return `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(
    verdi.trim(),
  ).replace(/\n/g, "<br>")}</span></div>`;
}

function byggHtml(data: PlukklisteData): string {
  const dato = new Date(data.ordreDato);
  const gyldigDato = !Number.isNaN(dato.getTime());
  const datoTekst = gyldigDato
    ? dato.toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" })
    : esc(data.ordreDato);
  const datoKort = gyldigDato ? dato.toISOString().slice(0, 10) : "";

  const totaltStk = data.linjer.reduce((s, l) => s + l.antall, 0);
  const k = data.kunde;
  const tittelKunde = k?.firma?.trim() || k?.navn?.trim() || "";
  const filnavn = ["Plukkliste", tittelKunde, datoKort].filter(Boolean).join(" ");

  const kundeBlokk = k
    ? `<div class="boks">
        <h2>Kunde</h2>
        ${radioLinje("Navn", k.navn)}
        ${radioLinje("Bedrift", k.firma && k.firma !== k.navn ? k.firma : null)}
        ${radioLinje("Kontaktperson", k.kontaktperson)}
        ${radioLinje("Adresse", k.adresse)}
        ${radioLinje("Kundenr.", k.kundenr)}
        ${radioLinje("E-post", k.epost)}
        ${radioLinje("Telefon", k.telefon)}
      </div>`
    : `<div class="boks"><h2>Kunde</h2><div class="kv"><span class="v">Ingen kunde valgt</span></div></div>`;

  const rader = data.linjer
    .map(
      (l, i) => `<tr>
        <td class="nr">${i + 1}</td>
        <td>${esc(l.navn)}</td>
        <td class="sku">${esc(l.sku)}</td>
        <td>${esc(l.merke ?? "")}</td>
        <td class="antall">${l.antall}</td>
        <td class="hake"></td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<title>${esc(filnavn)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin: 0 0 8px; }
  .topp { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a6f3d; padding-bottom: 10px; margin-bottom: 16px; }
  .meta { text-align: right; color: #444; font-size: 11px; line-height: 1.5; }
  .rad { display: flex; gap: 16px; margin-bottom: 16px; }
  .boks { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .kv { display: flex; gap: 8px; margin: 3px 0; }
  .kv .k { color: #777; min-width: 96px; }
  .kv .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; border-bottom: 2px solid #333; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  td { border-bottom: 1px solid #e2e2e2; padding: 7px 8px; vertical-align: top; }
  td.nr, th.nr { width: 28px; color: #999; }
  td.sku { font-family: "SF Mono", Consolas, monospace; font-size: 11px; }
  td.antall, th.antall { text-align: right; font-weight: 700; width: 64px; }
  td.hake, th.hake { width: 40px; }
  td.hake { border: 1px solid #e2e2e2; }
  tfoot td { border-top: 2px solid #333; font-weight: 700; }
  .signatur { margin-top: 40px; display: flex; gap: 40px; }
  .signatur div { flex: 1; border-top: 1px solid #999; padding-top: 6px; color: #777; }
  @media print {
    body { margin: 12mm; }
    .signatur { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="topp">
    <div>
      <h1>${esc(data.tittel)}</h1>
      <div style="color:#666">${tittelKunde ? esc(tittelKunde) : ""}</div>
    </div>
    <div class="meta">
      ${esc(datoTekst)}<br>
      Lokasjon: ${esc(data.lokasjon)}<br>
      Registrert av: ${esc(data.registrertAv)}${
        data.formaal ? `<br>Formål: ${esc(data.formaal)}` : ""
      }
    </div>
  </div>

  <div class="rad">
    ${kundeBlokk}
  </div>

  <table>
    <thead>
      <tr>
        <th class="nr">#</th>
        <th>Artikkel</th>
        <th>SKU</th>
        <th>Merke</th>
        <th class="antall">Antall</th>
        <th class="hake">Plukket</th>
      </tr>
    </thead>
    <tbody>
      ${rader}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Sum ${data.linjer.length} varelinjer</td>
        <td class="antall">${totaltStk}</td>
        <td class="hake"></td>
      </tr>
    </tfoot>
  </table>

  <div class="signatur">
    <div>Plukket av / dato</div>
    <div>Kvittert mottatt / dato</div>
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

/**
 * Åpner plukklista i en ny fane og trigger utskriftsdialogen. Web-only;
 * på native gjør den ingenting (ingen native-print-modul i prosjektet ennå).
 * Returnerer false hvis den ikke kunne åpnes (f.eks. popup blokkert).
 */
export function åpnePlukkliste(data: PlukklisteData): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const html = byggHtml(data);
  const vindu = window.open("", "_blank");
  if (vindu) {
    vindu.document.open();
    vindu.document.write(html);
    vindu.document.close();
    return true;
  }
  // Popup blokkert: last ned som HTML-fil i stedet (kan åpnes og skrives ut).
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plukkliste.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
