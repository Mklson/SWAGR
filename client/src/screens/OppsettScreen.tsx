import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ApiFeil,
  listBrukere,
  listKontekster,
  listLeverandorer,
  listLokasjoner,
  listMerker,
  opprettBruker,
  opprettKontekst,
  opprettLeverandor,
  opprettLokasjon,
  opprettMerke,
} from "../api";
import { gjettKolonne, parseCsv } from "../lib/csv";
import { velgTekstfil } from "../lib/nettleserFil";
import type { Bruker, Kontekst, KontekstType, Leverandor, Lokasjon, Merke } from "../types";
import {
  FeilBanner,
  Knapp,
  Kort,
  Miniatyr,
  Sammenleggbar,
  TekstFelt,
  TomListeTekst,
  VelgFelt,
} from "../components/ui";

const KONTEKST_TYPER: { verdi: KontekstType; label: string }[] = [
  { verdi: "kunde", label: "Kunde" },
  { verdi: "prosjekt", label: "Prosjekt" },
  { verdi: "internbruk", label: "Internbruk" },
  { verdi: "svinn", label: "Svinn" },
  { verdi: "retur", label: "Retur" },
  { verdi: "innkjop", label: "Innkjøp" },
];

export function OppsettScreen() {
  const [leverandorer, setLeverandorer] = useState<Leverandor[]>([]);
  const [lokasjoner, setLokasjoner] = useState<Lokasjon[]>([]);
  const [kontekster, setKontekster] = useState<Kontekst[]>([]);
  const [brukere, setBrukere] = useState<Bruker[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);

  const lastInn = useCallback(async () => {
    const [l, lo, k, b, m] = await Promise.all([
      listLeverandorer(),
      listLokasjoner(),
      listKontekster(),
      listBrukere(),
      listMerker(),
    ]);
    setLeverandorer(l);
    setLokasjoner(lo);
    setKontekster(k);
    setBrukere(b);
    setMerker(m);
  }, []);

  useEffect(() => {
    lastInn();
  }, [lastInn]);

  const [apen, setApen] = useState<string | null>("leverandor");
  const toggle = (s: string) => setApen((n) => (n === s ? null : s));

  return (
    <ScrollView
      style={stiler.rot}
      contentContainerStyle={stiler.scrollInnhold}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={stiler.tittel}>Oppsett</Text>
      <Text style={stiler.undertekst}>Referansedata brukt ved registrering av bevegelser</Text>

      <Sammenleggbar tittel="Leverandører" apen={apen === "leverandor"} onToggle={() => toggle("leverandor")}>
        <LeverandorSeksjon leverandorer={leverandorer} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Lokasjoner" apen={apen === "lokasjon"} onToggle={() => toggle("lokasjon")}>
        <LokasjonSeksjon lokasjoner={lokasjoner} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Merker" apen={apen === "merke"} onToggle={() => toggle("merke")}>
        <MerkeSeksjon merker={merker} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Formål" apen={apen === "formaal"} onToggle={() => toggle("formaal")}>
        <KontekstSeksjon kontekster={kontekster} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar
        tittel="Importer kunder fra CSV"
        apen={apen === "import"}
        onToggle={() => toggle("import")}
      >
        <KundeImportSeksjon kontekster={kontekster} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Brukere" apen={apen === "bruker"} onToggle={() => toggle("bruker")}>
        <BrukerSeksjon brukere={brukere} onLagtTil={lastInn} />
      </Sammenleggbar>
    </ScrollView>
  );
}

function MerkeSeksjon({ merker, onLagtTil }: { merker: Merke[]; onLagtTil: () => Promise<void> }) {
  const [navn, setNavn] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function leggTil() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    setLaster(true);
    try {
      await opprettMerke({ navn: navn.trim(), logoUrl: logoUrl.trim() || undefined });
      setNavn("");
      setLogoUrl("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette merke.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <Text style={stiler.hjelpetekst}>
        Brukes for gruppering og filtrering av varianter etter merke/kunde-logo på Beholdning.
      </Text>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Acme Events" />
      <TekstFelt
        label="Logo-URL (valgfritt)"
        value={logoUrl}
        onChangeText={setLogoUrl}
        placeholder="https://..."
      />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til merke" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {merker.length === 0 ? (
          <TomListeTekst tekst="Ingen merker registrert ennå." />
        ) : (
          merker.map((m) => (
            <Kort key={m.id}>
              <View style={stiler.merkeRad}>
                <Miniatyr url={m.logoUrl} bokstav={m.navn} storrelse={32} />
                <Text style={stiler.radTittel}>{m.navn}</Text>
              </View>
            </Kort>
          ))
        )}
      </View>
    </View>
  );
}

const INGEN_KOLONNE = "__ingen__";

/** Importerer eksisterende kunder fra en CSV-eksport fra et annet system,
 * som Kontekst(type=kunde) - vi bygger ikke en egen kundetabell, kundene
 * dere allerede har er kilden til sannhet, dette er bare en engangs-/
 * gjentakbar innlasting så dere slipper å opprette dem manuelt på nytt. */
function KundeImportSeksjon({
  kontekster,
  onLagtTil,
}: {
  kontekster: Kontekst[];
  onLagtTil: () => Promise<void>;
}) {
  const [filnavn, setFilnavn] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rader, setRader] = useState<string[][]>([]);
  const [navnKolonne, setNavnKolonne] = useState<string | null>(null);
  const [referanseKolonne, setReferanseKolonne] = useState<string | null>(INGEN_KOLONNE);
  const [feil, setFeil] = useState<string | null>(null);
  const [importerer, setImporterer] = useState(false);
  const [fremdrift, setFremdrift] = useState<{ ferdig: number; totalt: number } | null>(null);
  const [resultat, setResultat] = useState<{ importert: number; hoppetOver: number; feilet: number } | null>(null);

  const eksisterendeNavn = useMemo(
    () => new Set(kontekster.filter((k) => k.type === "kunde").map((k) => k.navn.trim().toLowerCase())),
    [kontekster],
  );

  const kolonneAlternativer = useMemo(() => headers.map((h, i) => ({ verdi: String(i), label: h })), [headers]);
  const referanseAlternativer = useMemo(
    () => [{ verdi: INGEN_KOLONNE, label: "Ingen" }, ...kolonneAlternativer],
    [kolonneAlternativer],
  );

  async function velgFil() {
    setFeil(null);
    setResultat(null);
    const valgt = await velgTekstfil(".csv,text/csv");
    if (!valgt) {
      setFeil("Filvalg er kun støttet i nettleser-versjonen foreløpig, eller ingen fil ble valgt.");
      return;
    }
    const { headers: h, rader: r } = parseCsv(valgt.tekst);
    if (h.length === 0) {
      setFeil("Fant ingen data i filen. Sjekk at det er en gyldig CSV-fil.");
      return;
    }
    setFilnavn(valgt.filnavn);
    setHeaders(h);
    setRader(r);
    const gjettetNavn = gjettKolonne(h, ["navn", "firma", "kunde", "name", "company"]);
    setNavnKolonne(gjettetNavn !== null ? String(gjettetNavn) : String(0));
    const gjettetReferanse = gjettKolonne(h, ["referanse", "kundenr", "nummer", "org", "id"]);
    setReferanseKolonne(gjettetReferanse !== null ? String(gjettetReferanse) : INGEN_KOLONNE);
  }

  async function importer() {
    if (navnKolonne === null) {
      setFeil("Velg hvilken kolonne som er navnet.");
      return;
    }
    setFeil(null);
    setImporterer(true);
    const navnIdx = Number(navnKolonne);
    const referanseIdx = referanseKolonne !== null && referanseKolonne !== INGEN_KOLONNE ? Number(referanseKolonne) : null;

    let importert = 0;
    let hoppetOver = 0;
    let feilet = 0;
    setFremdrift({ ferdig: 0, totalt: rader.length });

    for (let i = 0; i < rader.length; i++) {
      const navn = rader[i][navnIdx]?.trim();
      const referanse = referanseIdx !== null ? rader[i][referanseIdx]?.trim() || undefined : undefined;
      if (!navn) {
        feilet++;
      } else if (eksisterendeNavn.has(navn.toLowerCase())) {
        hoppetOver++;
      } else {
        try {
          await opprettKontekst({ type: "kunde", navn, referanse });
          eksisterendeNavn.add(navn.toLowerCase());
          importert++;
        } catch {
          feilet++;
        }
      }
      setFremdrift({ ferdig: i + 1, totalt: rader.length });
    }

    setResultat({ importert, hoppetOver, feilet });
    setImporterer(false);
    setFremdrift(null);
    await onLagtTil();
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <Text style={stiler.hjelpetekst}>
        Har dere allerede en kundeliste i et annet system (regnskap, CRM)? Eksporter den som CSV
        (i Excel: Fil → Lagre som → CSV) og last den opp her i stedet for å opprette kundene på
        nytt. Kan kjøres flere ganger — kunder som allerede finnes (samme navn) hoppes over.
      </Text>

      <Knapp tittel={filnavn ? `Valgt: ${filnavn}` : "Velg CSV-fil"} onPress={velgFil} variant="sekundaer" />

      {headers.length > 0 && (
        <>
          <VelgFelt label="Navn-kolonne" valgt={navnKolonne} alternativer={kolonneAlternativer} onVelg={setNavnKolonne} />
          <VelgFelt
            label="Referanse-kolonne (valgfritt, f.eks. kundenr.)"
            valgt={referanseKolonne}
            alternativer={referanseAlternativer}
            onVelg={setReferanseKolonne}
          />

          <Text style={stiler.forhandsvisningTittel}>
            {rader.length} rader funnet — forhåndsvisning av de 3 første:
          </Text>
          {rader.slice(0, 3).map((rad, i) => {
            const navnIdx = navnKolonne !== null ? Number(navnKolonne) : 0;
            const referanseIdx = referanseKolonne !== null && referanseKolonne !== INGEN_KOLONNE ? Number(referanseKolonne) : null;
            return (
              <Kort key={i}>
                <Text style={stiler.radTittel}>{rad[navnIdx] || "(tomt navn)"}</Text>
                {referanseIdx !== null && <Text style={stiler.radUndertekst}>{rad[referanseIdx]}</Text>}
              </Kort>
            );
          })}
        </>
      )}

      {feil && <FeilBanner tekst={feil} />}
      {fremdrift && (
        <Text style={stiler.hjelpetekst}>
          Importerer {fremdrift.ferdig} av {fremdrift.totalt}...
        </Text>
      )}
      {resultat && (
        <Text style={stiler.resultatTekst}>
          {resultat.importert} importert, {resultat.hoppetOver} fantes allerede, {resultat.feilet} feilet.
        </Text>
      )}

      {headers.length > 0 && (
        <Knapp tittel={`Importer ${rader.length} kunder`} onPress={importer} disabled={importerer} />
      )}
    </View>
  );
}

function LeverandorSeksjon({
  leverandorer,
  onLagtTil,
}: {
  leverandorer: Leverandor[];
  onLagtTil: () => Promise<void>;
}) {
  const [navn, setNavn] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function leggTil() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    setLaster(true);
    try {
      await opprettLeverandor({ navn: navn.trim() });
      setNavn("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette leverandør.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Nordic Supplies AS" />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til leverandør" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {leverandorer.length === 0 ? (
          <TomListeTekst tekst="Ingen leverandører registrert ennå." />
        ) : (
          leverandorer.map((l) => (
            <Kort key={l.id}>
              <Text style={stiler.radTittel}>{l.navn}</Text>
            </Kort>
          ))
        )}
      </View>
    </View>
  );
}

function LokasjonSeksjon({
  lokasjoner,
  onLagtTil,
}: {
  lokasjoner: Lokasjon[];
  onLagtTil: () => Promise<void>;
}) {
  const [navn, setNavn] = useState("");
  const [type, setType] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function leggTil() {
    setFeil(null);
    if (!navn.trim() || !type.trim()) {
      setFeil("Fyll ut navn og type.");
      return;
    }
    setLaster(true);
    try {
      await opprettLokasjon({ navn: navn.trim(), type: type.trim() });
      setNavn("");
      setType("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette lokasjon.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Hovedlager" />
      <TekstFelt label="Type" value={type} onChangeText={setType} placeholder="F.eks. lager, bil, butikk" />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til lokasjon" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {lokasjoner.length === 0 ? (
          <TomListeTekst tekst="Ingen lokasjoner registrert ennå." />
        ) : (
          lokasjoner.map((l) => (
            <Kort key={l.id}>
              <Text style={stiler.radTittel}>{l.navn}</Text>
              <Text style={stiler.radUndertekst}>{l.type}</Text>
            </Kort>
          ))
        )}
      </View>
    </View>
  );
}

function KontekstSeksjon({
  kontekster,
  onLagtTil,
}: {
  kontekster: Kontekst[];
  onLagtTil: () => Promise<void>;
}) {
  const [navn, setNavn] = useState("");
  const [type, setType] = useState<KontekstType | null>(null);
  const [referanse, setReferanse] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function leggTil() {
    setFeil(null);
    if (!navn.trim() || !type) {
      setFeil("Fyll ut navn og type.");
      return;
    }
    setLaster(true);
    try {
      await opprettKontekst({ navn: navn.trim(), type, referanse: referanse.trim() || undefined });
      setNavn("");
      setReferanse("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette kontekst.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <VelgFelt label="Type" valgt={type} alternativer={KONTEKST_TYPER} onVelg={(v) => setType(v as KontekstType)} />
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Kunde AS / Event X" />
      <TekstFelt
        label="Referanse (valgfritt)"
        value={referanse}
        onChangeText={setReferanse}
        placeholder="F.eks. ordrenr."
      />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til formål" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {kontekster.length === 0 ? (
          <TomListeTekst tekst="Ingen formål registrert ennå." />
        ) : (
          kontekster.map((k) => (
            <Kort key={k.id}>
              <Text style={stiler.radTittel}>{k.navn}</Text>
              <Text style={stiler.radUndertekst}>{k.type}</Text>
            </Kort>
          ))
        )}
      </View>
    </View>
  );
}

function BrukerSeksjon({ brukere, onLagtTil }: { brukere: Bruker[]; onLagtTil: () => Promise<void> }) {
  const [navn, setNavn] = useState("");
  const [rolle, setRolle] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function leggTil() {
    setFeil(null);
    if (!navn.trim() || !rolle.trim()) {
      setFeil("Fyll ut navn og rolle.");
      return;
    }
    setLaster(true);
    try {
      await opprettBruker({ navn: navn.trim(), rolle: rolle.trim() });
      setNavn("");
      setRolle("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette bruker.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Kari Nordmann" />
      <TekstFelt label="Rolle" value={rolle} onChangeText={setRolle} placeholder="F.eks. Lagermedarbeider" />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til bruker" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {brukere.length === 0 ? (
          <TomListeTekst tekst="Ingen brukere registrert ennå." />
        ) : (
          brukere.map((b) => (
            <Kort key={b.id}>
              <Text style={stiler.radTittel}>{b.navn}</Text>
              <Text style={stiler.radUndertekst}>{b.rolle}</Text>
            </Kort>
          ))
        )}
      </View>
    </View>
  );
}

const stiler = StyleSheet.create({
  rot: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollInnhold: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 10,
  },
  tittel: {
    fontSize: 24,
    fontWeight: "700",
  },
  undertekst: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  seksjonInnhold: {
    gap: 12,
  },
  liste: {
    gap: 8,
  },
  radTittel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
  },
  radUndertekst: {
    fontSize: 13,
    color: "#888",
  },
  hjelpetekst: {
    fontSize: 13,
    color: "#888",
  },
  forhandsvisningTittel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginTop: 4,
  },
  resultatTekst: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a6f3d",
  },
  merkeRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
