// Filvalg finnes kun som nettleser-API (input[type=file] + FileReader) - ingen
// Expo-modul lagt til for dette (unngår ny native-avhengighet, se AGENTS.md).
// Bruker document.createElement direkte i stedet for JSX <input>, som unngår
// avhengighet av DOM-JSX-typer i et React Native-prosjekt.
// Resolver null på native eller hvis brukeren avbryter valget.

export function velgTekstfil(accept: string): Promise<{ tekst: string; filnavn: string } | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const fil = input.files?.[0];
      if (!fil) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ tekst: String(reader.result ?? ""), filnavn: fil.name });
      reader.onerror = () => resolve(null);
      reader.readAsText(fil);
    };
    input.click();
  });
}
