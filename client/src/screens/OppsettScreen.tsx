import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ApiFeil,
  hentMeg,
  lastOppBilde,
  listBrukere,
  listFormaal,
  listKontekster,
  listLeverandorer,
  listLokasjoner,
  listMerker,
  oppdaterBedrift,
  oppdaterBruker,
  oppdaterFormaal,
  oppdaterKontekst,
  oppdaterLeverandor,
  oppdaterLokasjon,
  oppdaterMerke,
  opprettBruker,
  opprettFormaal,
  opprettKontekst,
  opprettLeverandor,
  opprettLokasjon,
  opprettMerke,
  slettBruker,
  slettFormaal,
  slettKontekst,
  slettLeverandor,
  slettLokasjon,
  slettMerke,
} from "../api";
import { gjettKolonne, parseCsv } from "../lib/csv";
import { velgTekstfil } from "../lib/nettleserFil";
import { hentAktivBedrift, settBedrifter } from "../lib/auth";
import { BildeVelger } from "../components/BildeVelger";
import type { Bruker, Formaal, Kontekst, Leverandor, Lokasjon, Merke } from "../types";
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

export function OppsettScreen() {
  const [leverandorer, setLeverandorer] = useState<Leverandor[]>([]);
  const [lokasjoner, setLokasjoner] = useState<Lokasjon[]>([]);
  const [kontekster, setKontekster] = useState<Kontekst[]>([]);
  const [formaal, setFormaal] = useState<Formaal[]>([]);
  const [brukere, setBrukere] = useState<Bruker[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);

  const lastInn = useCallback(async () => {
    const [l, lo, k, f, b, m] = await Promise.all([
      listLeverandorer(),
      listLokasjoner(),
      listKontekster(),
      listFormaal(),
      listBrukere(),
      listMerker(),
    ]);
    setLeverandorer(l);
    setLokasjoner(lo);
    setKontekster(k);
    setFormaal(f);
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
      <Text style={stiler.undertekst}>
        Referansedata brukt ved registrering av bevegelser. Alle i bedriften kan redigere.
      </Text>

      <Sammenleggbar tittel="Bedrift" apen={apen === "bedrift"} onToggle={() => toggle("bedrift")}>
        <BedriftSeksjon />
      </Sammenleggbar>

      <Sammenleggbar tittel="Leverandører" apen={apen === "leverandor"} onToggle={() => toggle("leverandor")}>
        <LeverandorSeksjon leverandorer={leverandorer} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Lokasjoner" apen={apen === "lokasjon"} onToggle={() => toggle("lokasjon")}>
        <LokasjonSeksjon lokasjoner={lokasjoner} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Merker" apen={apen === "merke"} onToggle={() => toggle("merke")}>
        <MerkeSeksjon merker={merker} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Kunder" apen={apen === "kunde"} onToggle={() => toggle("kunde")}>
        <KunderSeksjon kontekster={kontekster} onLagtTil={lastInn} />
      </Sammenleggbar>
      <Sammenleggbar tittel="Formål" apen={apen === "formaal"} onToggle={() => toggle("formaal")}>
        <FormaalSeksjon formaal={formaal} onLagtTil={lastInn} />
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

interface RedigerFelt {
  nokkel: string;
  label: string;
  start: string;
  placeholder?: string;
  valgfri?: boolean;
}

/** Én rad i en oppsett-liste: viser verdien, "Rediger" folder ut felt for
 * endring + sletting. Brukes for alle rene tekst-referansetabeller. */
function RedigerRad({
  tittel,
  undertekst,
  felter,
  onLagre,
  onSlett,
}: {
  tittel: string;
  undertekst?: string;
  felter: RedigerFelt[];
  onLagre: (verdier: Record<string, string>) => Promise<void>;
  onSlett: () => Promise<void>;
}) {
  const [rediger, setRediger] = useState(false);
  const [verdier, setVerdier] = useState<Record<string, string>>({});
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [bekreftSlett, setBekreftSlett] = useState(false);

  function apne() {
    setVerdier(Object.fromEntries(felter.map((f) => [f.nokkel, f.start])));
    setFeil(null);
    setBekreftSlett(false);
    setRediger(true);
  }

  async function lagre() {
    setFeil(null);
    if (felter.some((f) => !f.valgfri && !verdier[f.nokkel]?.trim())) {
      setFeil("Fyll ut alle påkrevde felter.");
      return;
    }
    setLaster(true);
    try {
      await onLagre(Object.fromEntries(felter.map((f) => [f.nokkel, (verdier[f.nokkel] ?? "").trim()])));
      setRediger(false);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre.");
    } finally {
      setLaster(false);
    }
  }

  async function slett() {
    setFeil(null);
    setLaster(true);
    try {
      await onSlett();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke slette.");
      setLaster(false);
    }
  }

  if (!rediger) {
    return (
      <Kort>
        <View style={stiler.radMedHandling}>
          <View style={{ flex: 1 }}>
            <Text style={stiler.radTittel}>{tittel}</Text>
            {undertekst ? <Text style={stiler.radUndertekst}>{undertekst}</Text> : null}
          </View>
          <Pressable onPress={apne} hitSlop={8}>
            <Text style={stiler.lenkeTekst}>Rediger</Text>
          </Pressable>
        </View>
      </Kort>
    );
  }

  return (
    <Kort>
      {felter.map((f) => (
        <TekstFelt
          key={f.nokkel}
          label={f.label}
          value={verdier[f.nokkel] ?? ""}
          onChangeText={(v) => setVerdier((forrige) => ({ ...forrige, [f.nokkel]: v }))}
          placeholder={f.placeholder}
        />
      ))}
      {feil && <FeilBanner tekst={feil} />}
      {bekreftSlett ? (
        <View style={stiler.knappRad}>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Avbryt" onPress={() => setBekreftSlett(false)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Bekreft sletting" onPress={slett} disabled={laster} />
          </View>
        </View>
      ) : (
        <View style={stiler.knappRad}>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Avbryt" onPress={() => setRediger(false)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Slett" onPress={() => setBekreftSlett(true)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Lagre" onPress={lagre} disabled={laster} />
          </View>
        </View>
      )}
    </Kort>
  );
}

/** Merke-rad med navn + logo (opplasting av fil, ikke URL). */
function RedigerMerkeRad({
  merke,
  onEndret,
}: {
  merke: Merke;
  onEndret: () => Promise<void>;
}) {
  const [rediger, setRediger] = useState(false);
  const [navn, setNavn] = useState(merke.navn);
  const [logoUrl, setLogoUrl] = useState<string | null>(merke.logoUrl);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [bildeLaster, setBildeLaster] = useState(false);
  const [bekreftSlett, setBekreftSlett] = useState(false);

  function apne() {
    setNavn(merke.navn);
    setLogoUrl(merke.logoUrl);
    setFeil(null);
    setBekreftSlett(false);
    setRediger(true);
  }

  async function bildeValgt(bilde: { base64: string }) {
    setFeil(null);
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      await oppdaterMerke(merke.id, { logoUrl: url });
      setLogoUrl(url);
      await onEndret();
    } catch (err) {
      setFeil(err instanceof Error ? `Logo feilet: ${err.message}` : "Kunne ikke laste opp logoen.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function fjernLogo() {
    setBildeLaster(true);
    try {
      await oppdaterMerke(merke.id, { logoUrl: null });
      setLogoUrl(null);
      await onEndret();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke fjerne logoen.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function lagreNavn() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    setLaster(true);
    try {
      await oppdaterMerke(merke.id, { navn: navn.trim() });
      await onEndret();
      setRediger(false);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre.");
    } finally {
      setLaster(false);
    }
  }

  async function slett() {
    setFeil(null);
    setLaster(true);
    try {
      await slettMerke(merke.id);
      await onEndret();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke slette.");
      setLaster(false);
    }
  }

  if (!rediger) {
    return (
      <Kort>
        <View style={stiler.radMedHandling}>
          <View style={stiler.merkeRad}>
            <Miniatyr url={merke.logoUrl} bokstav={merke.navn} storrelse={32} />
            <Text style={stiler.radTittel}>{merke.navn}</Text>
          </View>
          <Pressable onPress={apne} hitSlop={8}>
            <Text style={stiler.lenkeTekst}>Rediger</Text>
          </Pressable>
        </View>
      </Kort>
    );
  }

  return (
    <Kort>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} />
      {logoUrl ? (
        <View style={stiler.logoForhandsvisning}>
          <Image source={{ uri: logoUrl }} style={stiler.logoBilde} resizeMode="contain" />
        </View>
      ) : null}
      <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
      {logoUrl ? (
        <Knapp tittel="Fjern logo" onPress={fjernLogo} disabled={bildeLaster} variant="sekundaer" />
      ) : null}
      {feil && <FeilBanner tekst={feil} />}
      {bekreftSlett ? (
        <View style={stiler.knappRad}>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Avbryt" onPress={() => setBekreftSlett(false)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Bekreft sletting" onPress={slett} disabled={laster} />
          </View>
        </View>
      ) : (
        <View style={stiler.knappRad}>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Lukk" onPress={() => setRediger(false)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Slett" onPress={() => setBekreftSlett(true)} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Lagre navn" onPress={lagreNavn} disabled={laster} />
          </View>
        </View>
      )}
    </Kort>
  );
}

function BedriftSeksjon() {
  const bedrift = hentAktivBedrift();
  const [navn, setNavn] = useState(bedrift?.navn ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(bedrift?.logoUrl ?? null);
  const [bildeLaster, setBildeLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [suksess, setSuksess] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function oppdaterFraServer() {
    const meg = await hentMeg();
    settBedrifter(meg.bedrifter);
  }

  async function bildeValgt(bilde: { base64: string }) {
    setFeil(null);
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      await oppdaterBedrift({ logoUrl: url });
      setLogoUrl(url);
      await oppdaterFraServer();
      setSuksess("Logo oppdatert.");
    } catch (err) {
      setFeil(err instanceof Error ? `Logo feilet: ${err.message}` : "Kunne ikke laste opp logoen.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function lagreNavn() {
    setFeil(null);
    setSuksess(null);
    if (!navn.trim()) {
      setFeil("Fyll ut bedriftsnavn.");
      return;
    }
    setLaster(true);
    try {
      await oppdaterBedrift({ navn: navn.trim() });
      await oppdaterFraServer();
      setSuksess("Navn lagret.");
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre navnet.");
    } finally {
      setLaster(false);
    }
  }

  async function fjernLogo() {
    setBildeLaster(true);
    try {
      await oppdaterBedrift({ logoUrl: null });
      setLogoUrl(null);
      await oppdaterFraServer();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke fjerne logoen.");
    } finally {
      setBildeLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <Text style={stiler.hjelpetekst}>Navn og logo. Logoen vises øverst i appen for alle i bedriften.</Text>
      <TekstFelt label="Bedriftsnavn" value={navn} onChangeText={setNavn} />
      <Knapp tittel="Lagre navn" onPress={lagreNavn} disabled={laster} variant="sekundaer" />

      {logoUrl ? (
        <View style={stiler.logoForhandsvisning}>
          <Image source={{ uri: logoUrl }} style={stiler.logoBilde} resizeMode="contain" />
        </View>
      ) : null}
      <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
      {logoUrl ? (
        <Knapp tittel="Fjern logo" onPress={fjernLogo} disabled={bildeLaster} variant="sekundaer" />
      ) : null}

      {feil && <FeilBanner tekst={feil} />}
      {suksess && <Text style={stiler.resultatTekst}>{suksess}</Text>}
    </View>
  );
}

function MerkeSeksjon({ merker, onLagtTil }: { merker: Merke[]; onLagtTil: () => Promise<void> }) {
  const [navn, setNavn] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [bildeLaster, setBildeLaster] = useState(false);

  async function bildeValgt(bilde: { base64: string }) {
    setFeil(null);
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      setLogoUrl(url);
    } catch (err) {
      setFeil(err instanceof Error ? `Logo feilet: ${err.message}` : "Kunne ikke laste opp logoen.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function leggTil() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    setLaster(true);
    try {
      await opprettMerke({ navn: navn.trim(), logoUrl: logoUrl ?? undefined });
      setNavn("");
      setLogoUrl(null);
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
        Brukes for gruppering og filtrering av varianter etter merke/kunde-logo på Beholdning og
        Uttak. Last opp en logo-fil fra kamera eller bildebibliotek.
      </Text>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Acme Events" />
      {logoUrl ? (
        <View style={stiler.logoForhandsvisning}>
          <Image source={{ uri: logoUrl }} style={stiler.logoBilde} resizeMode="contain" />
        </View>
      ) : null}
      <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til merke" onPress={leggTil} disabled={laster || bildeLaster} variant="sekundaer" />
      <View style={stiler.liste}>
        {merker.length === 0 ? (
          <TomListeTekst tekst="Ingen merker registrert ennå." />
        ) : (
          merker.map((m) => <RedigerMerkeRad key={m.id} merke={m} onEndret={onLagtTil} />)
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
            <RedigerRad
              key={l.id}
              tittel={l.navn}
              felter={[{ nokkel: "navn", label: "Navn", start: l.navn }]}
              onLagre={async (v) => {
                await oppdaterLeverandor(l.id, { navn: v.navn });
                await onLagtTil();
              }}
              onSlett={async () => {
                await slettLeverandor(l.id);
                await onLagtTil();
              }}
            />
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
            <RedigerRad
              key={l.id}
              tittel={l.navn}
              undertekst={l.type}
              felter={[
                { nokkel: "navn", label: "Navn", start: l.navn },
                { nokkel: "type", label: "Type", start: l.type },
              ]}
              onLagre={async (v) => {
                await oppdaterLokasjon(l.id, { navn: v.navn, type: v.type });
                await onLagtTil();
              }}
              onSlett={async () => {
                await slettLokasjon(l.id);
                await onLagtTil();
              }}
            />
          ))
        )}
      </View>
    </View>
  );
}

function KunderSeksjon({
  kontekster,
  onLagtTil,
}: {
  kontekster: Kontekst[];
  onLagtTil: () => Promise<void>;
}) {
  const [navn, setNavn] = useState("");
  const [kundenr, setKundenr] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  const kunder = kontekster.filter((k) => k.type === "kunde");

  async function leggTil() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    setLaster(true);
    try {
      await opprettKontekst({
        navn: navn.trim(),
        type: "kunde",
        referanse: kundenr.trim() || undefined,
      });
      setNavn("");
      setKundenr("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette kunden.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <Text style={stiler.hjelpetekst}>
        Kundene et uttak kan registreres på. Kan også lastes inn i bulk fra CSV nedenfor.
      </Text>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Solstrand Hotell" />
      <TekstFelt
        label="Kundenr (valgfritt)"
        value={kundenr}
        onChangeText={setKundenr}
        placeholder="F.eks. 1042"
      />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til kunde" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {kunder.length === 0 ? (
          <TomListeTekst tekst="Ingen kunder registrert ennå." />
        ) : (
          kunder.map((k) => (
            <RedigerRad
              key={k.id}
              tittel={k.navn}
              undertekst={k.referanse ? `Kundenr: ${k.referanse}` : undefined}
              felter={[
                { nokkel: "navn", label: "Navn", start: k.navn },
                { nokkel: "kundenr", label: "Kundenr (valgfritt)", start: k.referanse ?? "", valgfri: true },
              ]}
              onLagre={async (v) => {
                await oppdaterKontekst(k.id, { navn: v.navn, referanse: v.kundenr || null });
                await onLagtTil();
              }}
              onSlett={async () => {
                await slettKontekst(k.id);
                await onLagtTil();
              }}
            />
          ))
        )}
      </View>
    </View>
  );
}

function FormaalSeksjon({
  formaal,
  onLagtTil,
}: {
  formaal: Formaal[];
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
      await opprettFormaal({ navn: navn.trim() });
      setNavn("");
      await onLagtTil();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette formålet.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.seksjonInnhold}>
      <Text style={stiler.hjelpetekst}>
        Hva et uttak er til — f.eks. Festival, Messe, Gave. Velges ved hvert uttak.
      </Text>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Festival" />
      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Legg til formål" onPress={leggTil} disabled={laster} variant="sekundaer" />
      <View style={stiler.liste}>
        {formaal.length === 0 ? (
          <TomListeTekst tekst="Ingen formål registrert ennå." />
        ) : (
          formaal.map((f) => (
            <RedigerRad
              key={f.id}
              tittel={f.navn}
              felter={[{ nokkel: "navn", label: "Navn", start: f.navn }]}
              onLagre={async (v) => {
                await oppdaterFormaal(f.id, { navn: v.navn });
                await onLagtTil();
              }}
              onSlett={async () => {
                await slettFormaal(f.id);
                await onLagtTil();
              }}
            />
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
            <RedigerRad
              key={b.id}
              tittel={b.navn}
              undertekst={b.epost ? `${b.rolle} · ${b.epost}` : b.rolle}
              felter={[
                { nokkel: "navn", label: "Navn", start: b.navn },
                { nokkel: "rolle", label: "Rolle", start: b.rolle },
              ]}
              onLagre={async (v) => {
                await oppdaterBruker(b.id, { navn: v.navn, rolle: v.rolle });
                await onLagtTil();
              }}
              onSlett={async () => {
                await slettBruker(b.id);
                await onLagtTil();
              }}
            />
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
    flex: 1,
  },
  radMedHandling: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lenkeTekst: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a6f3d",
  },
  knappRad: {
    flexDirection: "row",
    gap: 8,
  },
  knappRadCelle: {
    flex: 1,
  },
  logoForhandsvisning: {
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },
  logoBilde: {
    height: 56,
    width: "70%",
  },
});
