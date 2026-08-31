// Fast liste over varekategorier - brukes til dropdown ved oppretting/
// redigering av artikler og til filtrering i Uttak. Verdien lagres som ren
// tekst i Vare.kategori; eldre data kan avvike fra listen.
export const KATEGORIER = [
  "Glass",
  "Klær",
  "Barutstyr",
  "Messemateriell",
  "Dekor",
  "Trykksaker",
  "Profilartikler",
  "Annet",
] as const;

export type Kategori = (typeof KATEGORIER)[number];

export const KATEGORI_ALTERNATIVER = KATEGORIER.map((k) => ({ verdi: k, label: k }));
