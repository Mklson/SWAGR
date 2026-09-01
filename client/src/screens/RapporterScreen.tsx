import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ApiFeil,
  hentRapportFleksibel,
  hentRapportInngaende,
  hentRapportKontekst,
  hentRapportPeriode,
  listBevegelser,
  listKontekster,
  listLeverandorer,
  listLokasjoner,
  listMerker,
  listVarer,
  listVarianter,
} from "../api";
import { eksporterCsv } from "../lib/csvEksport";
import { formatterKroner, oreTilKrTekst } from "../lib/valuta";
import type {
  Bevegelse,
  Kontekst,
  Leverandor,
  Lokasjon,
  Merke,
  RapportFleksibelRad,
  RapportInngaendeRad,
  RapportKontekstRad,
  RapportPeriodeRad,
  Vare,
  Variant,
} from "../types";
import {
  farger,
  FeilBanner,
  Knapp,
  Kort,
  Sammenleggbar,
  TomListeTekst,
  VelgFelt,
} from "../components/ui";
import { Periodevelger } from "../components/Periodevelger";

function dagensDato(): string {
  return new Date().toISOString().slice(0, 10);
}

// Rapportene er foldet sammen når man kommer inn; hver åpnes uavhengig.
const RAPPORTER = [
  { nokkel: "fleksibel", tittel: "Fleksibel rapport: merke og/eller kunde" },
  { nokkel: "inngaende", tittel: "Inngående varer (varemottak)" },
  { nokkel: "periode", tittel: "Totalt per bevegelsestype" },
  { nokkel: "kontekst", tittel: "Totalt per variant for én kunde" },
  { nokkel: "historikk", tittel: "Full historikk for en kunde" },
] as const;

export function RapporterScreen() {
  const [varer, setVarer] = useState<Vare[]>([]);
  const [varianter, setVarianter] = useState<Variant[]>([]);
  const [lokasjoner, setLokasjoner] = useState<Lokasjon[]>([]);
  const [kontekster, setKontekster] = useState<Kontekst[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);
  const [leverandorer, setLeverandorer] = useState<Leverandor[]>([]);
  const [apne, setApne] = useState<Record<string, boolean>>({});

  const toggle = (n: string) => setApne((forrige) => ({ ...forrige, [n]: !forrige[n] }));

  const lastInn = useCallback(async () => {
    const [v, va, l, k, m, lev] = await Promise.all([
      listVarer(),
      listVarianter(),
      listLokasjoner(),
      listKontekster(),
      listMerker(),
      listLeverandorer(),
    ]);
    setVarer(v);
    setVarianter(va);
    setLokasjoner(l);
    setKontekster(k);
    setMerker(m);
    setLeverandorer(lev);
  }, []);

  useEffect(() => {
    lastInn();
  }, [lastInn]);

  const vareMap = useMemo(() => new Map(varer.map((v) => [v.id, v])), [varer]);
  const variantMap = useMemo(() => new Map(varianter.map((v) => [v.id, v])), [varianter]);
  const lokasjonAlternativer = useMemo(
    () => lokasjoner.map((l) => ({ verdi: l.id, label: l.navn })),
    [lokasjoner],
  );
  // Rapportfiltrene handler om kunde - de skjulte system-kontekstene
  // (varemottak/svinn/internbruk/retur) hører ikke hjemme i en kunde-velger.
  const kontekstAlternativer = useMemo(
    () =>
      kontekster
        .filter((k) => k.type === "kunde" || k.type === "prosjekt")
        .map((k) => ({ verdi: k.id, label: k.navn, undertekst: k.type })),
    [kontekster],
  );
  const merkeAlternativer = useMemo(() => merker.map((m) => ({ verdi: m.id, label: m.navn })), [merker]);
  const leverandorAlternativer = useMemo(
    () => leverandorer.map((l) => ({ verdi: l.id, label: l.navn })),
    [leverandorer],
  );
  const merkeMap = useMemo(() => new Map(merker.map((m) => [m.id, m])), [merker]);
  const kontekstMap = useMemo(() => new Map(kontekster.map((k) => [k.id, k])), [kontekster]);

  function variantNavn(variantId: string) {
    const variant = variantMap.get(variantId);
    const vareNavn = variant ? vareMap.get(variant.vareId)?.navn : undefined;
    return `${vareNavn ?? "Ukjent vare"} — ${variant?.sku ?? "?"}`;
  }

  const seksjoner: Record<string, React.ReactNode> = {
    fleksibel: (
      <FleksibelRapport
        merkeAlternativer={merkeAlternativer}
        kontekstAlternativer={kontekstAlternativer}
        merkeMap={merkeMap}
        kontekstMap={kontekstMap}
      />
    ),
    inngaende: (
      <InngaendeRapport
        lokasjonAlternativer={lokasjonAlternativer}
        merkeAlternativer={merkeAlternativer}
        leverandorAlternativer={leverandorAlternativer}
        variantNavn={variantNavn}
      />
    ),
    periode: (
      <PeriodeRapport
        lokasjonAlternativer={lokasjonAlternativer}
        kontekstAlternativer={kontekstAlternativer}
      />
    ),
    kontekst: (
      <KontekstRapport kontekstAlternativer={kontekstAlternativer} variantNavn={variantNavn} />
    ),
    historikk: (
      <KundeHistorikkSeksjon
        kontekstAlternativer={kontekstAlternativer}
        lokasjoner={lokasjoner}
        variantNavn={variantNavn}
      />
    ),
  };

  return (
    <ScrollView style={stiler.rot} contentContainerStyle={stiler.scrollInnhold}>
      <Text style={stiler.tittel}>Rapporter</Text>
      <Text style={stiler.undertekst}>Klikk på en rapport for å folde den ut.</Text>

      {RAPPORTER.map((r) => (
        <Sammenleggbar
          key={r.nokkel}
          tittel={r.tittel}
          apen={!!apne[r.nokkel]}
          onToggle={() => toggle(r.nokkel)}
        >
          {seksjoner[r.nokkel]}
        </Sammenleggbar>
      ))}
    </ScrollView>
  );
}

interface Gruppe {
  key: string;
  navn: string;
  antall: number;
  verdiOre: number;
  antallMedVerdi: number;
  typer: Map<string, number>;
}

function FleksibelRapport({
  merkeAlternativer,
  kontekstAlternativer,
  merkeMap,
  kontekstMap,
}: {
  merkeAlternativer: { verdi: string; label: string }[];
  kontekstAlternativer: { verdi: string; label: string; undertekst?: string }[];
  merkeMap: Map<string, Merke>;
  kontekstMap: Map<string, Kontekst>;
}) {
  const [merkeId, setMerkeId] = useState<string | null>(null);
  const [kontekstId, setKontekstId] = useState<string | null>(null);
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");
  const [rader, setRader] = useState<RapportFleksibelRad[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function hent() {
    setFeil(null);
    setLaster(true);
    try {
      const resultat = await hentRapportFleksibel({
        merkeId: merkeId ?? undefined,
        kontekstId: kontekstId ?? undefined,
        fra: fra.trim() || undefined,
        til: til.trim() || undefined,
      });
      setRader(resultat);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke hente rapport.");
    } finally {
      setLaster(false);
    }
  }

  // Grupperer etter det som IKKE er fastsatt av et filter: kun merke valgt ->
  // bryt ned per kunde; kun kontekst valgt -> bryt ned per merke; begge eller
  // ingen valgt -> bryt ned per kombinasjon.
  const grupper = useMemo<Gruppe[]>(() => {
    if (!rader) return [];
    const nøkkel = (r: RapportFleksibelRad) => {
      if (merkeId && !kontekstId) return r.kontekstId;
      if (kontekstId && !merkeId) return r.merkeId ?? "uten-merke";
      return `${r.kontekstId}:${r.merkeId ?? "uten-merke"}`;
    };
    const navn = (r: RapportFleksibelRad) => {
      const kundeNavn = kontekstMap.get(r.kontekstId)?.navn ?? "Ukjent kunde";
      const merkeNavn = r.merkeId ? merkeMap.get(r.merkeId)?.navn ?? "Ukjent merke" : "Uten merke";
      if (merkeId && !kontekstId) return kundeNavn;
      if (kontekstId && !merkeId) return merkeNavn;
      return `${kundeNavn} — ${merkeNavn}`;
    };

    const kart = new Map<string, Gruppe>();
    for (const r of rader) {
      const key = nøkkel(r);
      const eksisterende = kart.get(key) ?? {
        key,
        navn: navn(r),
        antall: 0,
        verdiOre: 0,
        antallMedVerdi: 0,
        typer: new Map<string, number>(),
      };
      eksisterende.antall += r.antall;
      eksisterende.verdiOre += r.verdiOre;
      eksisterende.antallMedVerdi += r.antallMedVerdi;
      eksisterende.typer.set(r.type, (eksisterende.typer.get(r.type) ?? 0) + r.antall);
      kart.set(key, eksisterende);
    }
    return Array.from(kart.values()).sort((a, b) => b.antall - a.antall);
  }, [rader, merkeId, kontekstId, merkeMap, kontekstMap]);

  const totalAntall = grupper.reduce((s, g) => s + g.antall, 0);
  const totalVerdi = grupper.reduce((s, g) => s + g.verdiOre, 0);
  const totalMedVerdi = grupper.reduce((s, g) => s + g.antallMedVerdi, 0);

  function eksporter() {
    eksporterCsv(
      `rapport-fleksibel-${dagensDato()}`,
      ["Navn", "Inn", "Ut", "Retur", "Svinn", "Internbruk", "Antall totalt", "Verdi (kr)"],
      grupper.map((g) => [
        g.navn,
        g.typer.get("inn") ?? 0,
        g.typer.get("ut") ?? 0,
        g.typer.get("retur") ?? 0,
        g.typer.get("svinn") ?? 0,
        g.typer.get("internbruk") ?? 0,
        g.antall,
        oreTilKrTekst(g.verdiOre),
      ]),
    );
  }

  return (
    <>
      <Text style={stiler.hjelpetekst}>
        Velg kun merke for å se det merket på tvers av alle kunder, kun kunde for å se den
        på tvers av alle merker, begge for én kombinasjon, eller ingen for alt.
      </Text>

      <VelgFelt
        label="Merke (valgfritt)"
        valgt={merkeId}
        alternativer={merkeAlternativer}
        onVelg={setMerkeId}
        tomtekst="Alle merker"
      />
      <VelgFelt
        label="Kunde (valgfritt)"
        valgt={kontekstId}
        alternativer={kontekstAlternativer}
        onVelg={setKontekstId}
        tomtekst="Alle kunder"
      />
      <Periodevelger fra={fra} til={til} onFraChange={setFra} onTilChange={setTil} />

      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Hent rapport" onPress={hent} disabled={laster} variant="sekundaer" />

      {rader !== null && (
        <View style={stiler.resultatListe}>
          {grupper.length === 0 ? (
            <TomListeTekst tekst="Ingen bevegelser matcher filteret." />
          ) : (
            <>
              <Kort>
                <Text style={stiler.totalTittel}>
                  Totalt{grupper.length > 1 ? ` — ${grupper.length} grupper` : ""}
                </Text>
                <Text style={stiler.totalVerdi}>{formatterKroner(totalVerdi)}</Text>
                <Text style={stiler.hjelpetekst}>{totalAntall} stk totalt</Text>
                {totalMedVerdi < totalAntall && (
                  <Text style={stiler.delvisTekst}>
                    Basert på {totalMedVerdi} av {totalAntall} stk — resten mangler registrert pris.
                  </Text>
                )}
              </Kort>
              <Knapp tittel="📊 Eksporter til Excel (CSV)" onPress={eksporter} variant="sekundaer" />
              {grupper.map((g) => (
                <Kort key={g.key}>
                  <Text style={stiler.radTittel}>{g.navn}</Text>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.resultatType}>
                      {Array.from(g.typer.entries())
                        .map(([t, a]) => `${t} ${a}`)
                        .join(" · ")}
                    </Text>
                    <Text style={stiler.resultatAntall}>{g.antall} stk</Text>
                  </View>
                  {g.antallMedVerdi > 0 && (
                    <Text style={stiler.radVerdi}>
                      {formatterKroner(g.verdiOre)}
                      {g.antallMedVerdi < g.antall ? ` (${g.antallMedVerdi} av ${g.antall} stk)` : ""}
                    </Text>
                  )}
                </Kort>
              ))}
            </>
          )}
        </View>
      )}
    </>
  );
}

function InngaendeRapport({
  lokasjonAlternativer,
  merkeAlternativer,
  leverandorAlternativer,
  variantNavn,
}: {
  lokasjonAlternativer: { verdi: string; label: string }[];
  merkeAlternativer: { verdi: string; label: string }[];
  leverandorAlternativer: { verdi: string; label: string }[];
  variantNavn: (variantId: string) => string;
}) {
  const [lokasjonId, setLokasjonId] = useState<string | null>(null);
  const [merkeId, setMerkeId] = useState<string | null>(null);
  const [leverandorId, setLeverandorId] = useState<string | null>(null);
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");
  const [rader, setRader] = useState<RapportInngaendeRad[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function hent() {
    setFeil(null);
    setLaster(true);
    try {
      const resultat = await hentRapportInngaende({
        lokasjonId: lokasjonId ?? undefined,
        merkeId: merkeId ?? undefined,
        leverandorId: leverandorId ?? undefined,
        fra: fra.trim() || undefined,
        til: til.trim() || undefined,
      });
      setRader(resultat);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke hente rapport.");
    } finally {
      setLaster(false);
    }
  }

  const totalAntall = (rader ?? []).reduce((s, r) => s + r.antall, 0);
  const totalVerdi = (rader ?? []).reduce((s, r) => s + r.verdiOre, 0);
  const totalMedVerdi = (rader ?? []).reduce((s, r) => s + r.antallMedVerdi, 0);

  function eksporter() {
    if (!rader) return;
    eksporterCsv(
      `rapport-inngaende-${dagensDato()}`,
      ["Vare/variant", "Antall inn", "Verdi (kr)", "Siste varemottak"],
      rader.map((r) => [
        variantNavn(r.variantId),
        r.antall,
        oreTilKrTekst(r.verdiOre),
        r.sisteInn ? new Date(r.sisteInn).toLocaleDateString("nb-NO") : "",
      ]),
    );
  }

  return (
    <>
      <Text style={stiler.hjelpetekst}>
        Alt som er registrert som varemottak (inn på lager), summert per artikkel. Filtrer på
        lokasjon, merke, leverandør og periode.
      </Text>

      <VelgFelt
        label="Lokasjon (valgfritt)"
        valgt={lokasjonId}
        alternativer={lokasjonAlternativer}
        onVelg={setLokasjonId}
        tomtekst="Alle lokasjoner"
      />
      <VelgFelt
        label="Merke (valgfritt)"
        valgt={merkeId}
        alternativer={merkeAlternativer}
        onVelg={setMerkeId}
        tomtekst="Alle merker"
      />
      <VelgFelt
        label="Leverandør (valgfritt)"
        valgt={leverandorId}
        alternativer={leverandorAlternativer}
        onVelg={setLeverandorId}
        tomtekst="Alle leverandører"
      />
      <Periodevelger fra={fra} til={til} onFraChange={setFra} onTilChange={setTil} />

      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Hent rapport" onPress={hent} disabled={laster} variant="sekundaer" />

      {rader !== null && (
        <View style={stiler.resultatListe}>
          {rader.length === 0 ? (
            <TomListeTekst tekst="Ingen varemottak matcher filteret." />
          ) : (
            <>
              <Kort>
                <Text style={stiler.totalTittel}>Totalt tatt inn</Text>
                <Text style={stiler.totalVerdi}>{formatterKroner(totalVerdi)}</Text>
                <Text style={stiler.hjelpetekst}>
                  {totalAntall} stk · {rader.length} artikler
                </Text>
                {totalMedVerdi < totalAntall && (
                  <Text style={stiler.delvisTekst}>
                    Verdi basert på {totalMedVerdi} av {totalAntall} stk — resten mangler registrert
                    kostpris.
                  </Text>
                )}
              </Kort>
              <Knapp tittel="📊 Eksporter til Excel (CSV)" onPress={eksporter} variant="sekundaer" />
              {rader.map((r) => (
                <Kort key={r.variantId}>
                  <Text style={stiler.radTittel}>{variantNavn(r.variantId)}</Text>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.resultatType}>
                      {r.sisteInn
                        ? `Siste: ${new Date(r.sisteInn).toLocaleDateString("nb-NO")}`
                        : ""}
                    </Text>
                    <Text style={stiler.resultatAntall}>{r.antall} stk</Text>
                  </View>
                  {r.antallMedVerdi > 0 && (
                    <Text style={stiler.radVerdi}>
                      {formatterKroner(r.verdiOre)}
                      {r.antallMedVerdi < r.antall ? ` (${r.antallMedVerdi} av ${r.antall} stk)` : ""}
                    </Text>
                  )}
                </Kort>
              ))}
            </>
          )}
        </View>
      )}
    </>
  );
}

function PeriodeRapport({
  lokasjonAlternativer,
  kontekstAlternativer,
}: {
  lokasjonAlternativer: { verdi: string; label: string }[];
  kontekstAlternativer: { verdi: string; label: string; undertekst?: string }[];
}) {
  const [lokasjonId, setLokasjonId] = useState<string | null>(null);
  const [kontekstId, setKontekstId] = useState<string | null>(null);
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");
  const [rader, setRader] = useState<RapportPeriodeRad[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function hent() {
    setFeil(null);
    setLaster(true);
    try {
      const resultat = await hentRapportPeriode({
        lokasjonId: lokasjonId ?? undefined,
        kontekstId: kontekstId ?? undefined,
        fra: fra.trim() || undefined,
        til: til.trim() || undefined,
      });
      setRader(resultat);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke hente rapport.");
    } finally {
      setLaster(false);
    }
  }

  function eksporter() {
    if (!rader) return;
    eksporterCsv(
      `rapport-periode-${dagensDato()}`,
      ["Type", "Antall", "Verdi (kr)"],
      rader.map((r) => [r.type, r.antall, oreTilKrTekst(r.verdiOre)]),
    );
  }

  return (
    <>
      <Text style={stiler.hjelpetekst}>
        F.eks. totalt svinn denne måneden, eller alt som har gått ut fra en lokasjon i en periode.
      </Text>

      <VelgFelt
        label="Lokasjon (valgfritt)"
        valgt={lokasjonId}
        alternativer={lokasjonAlternativer}
        onVelg={setLokasjonId}
        tomtekst="Alle lokasjoner"
      />
      <VelgFelt
        label="Kunde (valgfritt)"
        valgt={kontekstId}
        alternativer={kontekstAlternativer}
        onVelg={setKontekstId}
        tomtekst="Alle kunder"
      />
      <Periodevelger fra={fra} til={til} onFraChange={setFra} onTilChange={setTil} />

      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Hent rapport" onPress={hent} disabled={laster} variant="sekundaer" />

      {rader !== null && (
        <View style={stiler.resultatListe}>
          {rader.length === 0 ? (
            <TomListeTekst tekst="Ingen bevegelser i denne perioden." />
          ) : (
            <>
              <Knapp tittel="📊 Eksporter til Excel (CSV)" onPress={eksporter} variant="sekundaer" />
              {rader.map((rad) => (
                <Kort key={rad.type}>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.resultatType}>{rad.type}</Text>
                    <Text style={stiler.resultatAntall}>{rad.antall} stk</Text>
                  </View>
                  {rad.antallMedVerdi > 0 && (
                    <Text style={stiler.radVerdi}>
                      {formatterKroner(rad.verdiOre)}
                      {rad.antallMedVerdi < rad.antall ? ` (${rad.antallMedVerdi} av ${rad.antall} stk)` : ""}
                    </Text>
                  )}
                </Kort>
              ))}
            </>
          )}
        </View>
      )}
    </>
  );
}

function KontekstRapport({
  kontekstAlternativer,
  variantNavn,
}: {
  kontekstAlternativer: { verdi: string; label: string; undertekst?: string }[];
  variantNavn: (variantId: string) => string;
}) {
  const [kontekstId, setKontekstId] = useState<string | null>(null);
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");
  const [rader, setRader] = useState<RapportKontekstRad[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function hent() {
    setFeil(null);
    if (!kontekstId) {
      setFeil("Velg en kunde.");
      return;
    }
    setLaster(true);
    try {
      const resultat = await hentRapportKontekst(kontekstId, {
        fra: fra.trim() || undefined,
        til: til.trim() || undefined,
      });
      setRader(resultat);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke hente rapport.");
    } finally {
      setLaster(false);
    }
  }

  function eksporter() {
    if (!rader) return;
    eksporterCsv(
      `rapport-kunde-${dagensDato()}`,
      ["Vare/variant", "Type", "Antall", "Verdi (kr)"],
      rader.map((r) => [variantNavn(r.variantId), r.type, r.antall, oreTilKrTekst(r.verdiOre)]),
    );
  }

  return (
    <>
      <Text style={stiler.hjelpetekst}>
        F.eks. hvor mye som er levert til en gitt kunde, eller brukt på et gitt prosjekt.
      </Text>

      <VelgFelt label="Kunde" valgt={kontekstId} alternativer={kontekstAlternativer} onVelg={setKontekstId} />
      <Periodevelger fra={fra} til={til} onFraChange={setFra} onTilChange={setTil} />

      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Hent rapport" onPress={hent} disabled={laster} variant="sekundaer" />

      {rader !== null && (
        <View style={stiler.resultatListe}>
          {rader.length === 0 ? (
            <TomListeTekst tekst="Ingen bevegelser registrert for denne kunden." />
          ) : (
            <>
              {(() => {
                const utRader = rader.filter((r) => r.type === "ut");
                const totalVerdi = utRader.reduce((sum, r) => sum + r.verdiOre, 0);
                const totalAntall = utRader.reduce((sum, r) => sum + r.antall, 0);
                const totalMedVerdi = utRader.reduce((sum, r) => sum + r.antallMedVerdi, 0);
                if (totalAntall === 0) return null;
                return (
                  <Kort>
                    <Text style={stiler.totalTittel}>Total verdi levert (Ut)</Text>
                    <Text style={stiler.totalVerdi}>{formatterKroner(totalVerdi)}</Text>
                    {totalMedVerdi < totalAntall && (
                      <Text style={stiler.delvisTekst}>
                        Basert på {totalMedVerdi} av {totalAntall} stk — resten mangler registrert
                        pris (eldre bevegelser, eller variant uten verdi satt).
                      </Text>
                    )}
                  </Kort>
                );
              })()}
              <Knapp tittel="📊 Eksporter til Excel (CSV)" onPress={eksporter} variant="sekundaer" />
              {rader.map((rad, i) => (
                <Kort key={`${rad.variantId}-${rad.type}-${i}`}>
                  <Text style={stiler.radTittel}>{variantNavn(rad.variantId)}</Text>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.resultatType}>{rad.type}</Text>
                    <Text style={stiler.resultatAntall}>{rad.antall} stk</Text>
                  </View>
                  {rad.antallMedVerdi > 0 && (
                    <Text style={stiler.radVerdi}>
                      {formatterKroner(rad.verdiOre)}
                      {rad.antallMedVerdi < rad.antall ? ` (${rad.antallMedVerdi} av ${rad.antall} stk)` : ""}
                    </Text>
                  )}
                </Kort>
              ))}
            </>
          )}
        </View>
      )}
    </>
  );
}

function KundeHistorikkSeksjon({
  kontekstAlternativer,
  lokasjoner,
  variantNavn,
}: {
  kontekstAlternativer: { verdi: string; label: string; undertekst?: string }[];
  lokasjoner: Lokasjon[];
  variantNavn: (variantId: string) => string;
}) {
  const [kontekstId, setKontekstId] = useState<string | null>(null);
  const [bevegelser, setBevegelser] = useState<Bevegelse[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  const lokasjonMap = useMemo(() => new Map(lokasjoner.map((l) => [l.id, l])), [lokasjoner]);

  async function hent() {
    setFeil(null);
    if (!kontekstId) {
      setFeil("Velg en kunde.");
      return;
    }
    setLaster(true);
    try {
      setBevegelser(await listBevegelser({ kontekstId }));
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke hente historikk.");
    } finally {
      setLaster(false);
    }
  }

  function eksporter() {
    if (!bevegelser) return;
    eksporterCsv(
      `rapport-kundehistorikk-${dagensDato()}`,
      ["Dato", "Vare/variant", "Type", "Lokasjon", "Antall", "Verdi (kr)"],
      bevegelser.map((b) => [
        new Date(b.tidspunkt).toLocaleString("nb-NO"),
        variantNavn(b.variantId),
        b.type,
        lokasjonMap.get(b.lokasjonId)?.navn ?? "?",
        b.antall,
        b.verdiOre !== null ? oreTilKrTekst(b.verdiOre * b.antall) : "",
      ]),
    );
  }

  return (
    <>
      <Text style={stiler.hjelpetekst}>
        Hver enkelt bevegelse i rekkefølge — nyeste først. Nyttig for å se nøyaktig hva som har
        skjedd med én kunde, ikke bare summerte tall.
      </Text>

      <VelgFelt label="Kunde" valgt={kontekstId} alternativer={kontekstAlternativer} onVelg={setKontekstId} />

      {feil && <FeilBanner tekst={feil} />}
      <Knapp tittel="Hent historikk" onPress={hent} disabled={laster} variant="sekundaer" />

      {bevegelser !== null && (
        <View style={stiler.resultatListe}>
          {bevegelser.length === 0 ? (
            <TomListeTekst tekst="Ingen bevegelser registrert for denne kunden." />
          ) : (
            <>
              <Knapp tittel="📊 Eksporter til Excel (CSV)" onPress={eksporter} variant="sekundaer" />
              {bevegelser.map((b) => (
                <Kort key={b.id}>
                  <Text style={stiler.radTittel}>{variantNavn(b.variantId)}</Text>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.resultatType}>
                      {b.type} · {lokasjonMap.get(b.lokasjonId)?.navn ?? "?"}
                    </Text>
                    <Text style={stiler.resultatAntall}>{b.antall} stk</Text>
                  </View>
                  <View style={stiler.resultatRad}>
                    <Text style={stiler.historikkDato}>{new Date(b.tidspunkt).toLocaleString("nb-NO")}</Text>
                    {b.verdiOre !== null && (
                      <Text style={stiler.radVerdi}>{formatterKroner(b.verdiOre * b.antall)}</Text>
                    )}
                  </View>
                </Kort>
              ))}
            </>
          )}
        </View>
      )}
    </>
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
    paddingBottom: 32,
    gap: 10,
  },
  tittel: {
    fontSize: 24,
    fontWeight: "700",
  },
  undertekst: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  hjelpetekst: {
    fontSize: 13,
    color: "#888",
  },
  resultatListe: {
    gap: 8,
    marginTop: 4,
  },
  resultatRad: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultatType: {
    fontSize: 14,
    color: "#666",
    textTransform: "capitalize",
  },
  resultatAntall: {
    fontSize: 16,
    fontWeight: "700",
    color: farger.primaer,
  },
  radTittel: {
    fontSize: 14,
    fontWeight: "600",
    color: farger.tekst,
    marginBottom: 4,
  },
  totalTittel: {
    fontSize: 13,
    color: "#888",
  },
  totalVerdi: {
    fontSize: 22,
    fontWeight: "700",
    color: farger.primaer,
    marginTop: 2,
  },
  delvisTekst: {
    fontSize: 12,
    color: farger.advarselKant,
    marginTop: 6,
  },
  radVerdi: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.primaer,
    marginTop: 4,
  },
  historikkDato: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
});
