import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ApiFeil,
  fullforReservasjon,
  gjenkjennVariant,
  hentBeholdning,
  kansellerReservasjon,
  listBrukere,
  listKontekster,
  listLokasjoner,
  listMerker,
  listReservasjoner,
  listVarer,
  listVarianter,
  opprettBevegelse,
  opprettReservasjon,
} from "../api";
import { hentLagretVerdi, lagreVerdi } from "../lib/lagring";
import { hentLagretBruker } from "../lib/auth";
import { formatterKroner } from "../lib/valuta";
import { ALLE_KATEGORIER, MerkeOgKategoriFilter, UTEN_MERKE } from "../components/VareFilter";
import type {
  BeholdningRad,
  Bruker,
  Kontekst,
  KontekstType,
  Lokasjon,
  Merke,
  Reservasjon,
  Vare,
  Variant,
  VariantGjenkjenningResultat,
} from "../types";
import {
  AntallVelger,
  farger,
  FeilBanner,
  Knapp,
  Kort,
  Miniatyr,
  TekstFelt,
  TomListeTekst,
  VelgFelt,
} from "../components/ui";

const SISTE_BRUKER_NOKKEL = "artkl_hurtig_sist_bruker_id";

// Alle fem er nå her - svinn, internbruk og reserver er like mye "varen
// forlater/blokkeres på lageret av en grunn" som ut er, og drar nytte av
// akkurat samme raske kurv-flyt. Kun Registrer (inn/nye artikler) er igjen
// utenfor - samlet under navnet "Uttak".
type HurtigType = "ut" | "retur" | "svinn" | "internbruk" | "reserver";

const TYPE_LABEL: Record<HurtigType, string> = {
  ut: "Ta ut",
  retur: "Retur",
  svinn: "Svinn",
  internbruk: "Internbruk",
  reserver: "Reserver",
};

// Kortere tekst til den smale knapperaden - "Internbruk" og "Reserver" er
// for lange til å garantert holde seg på én linje ved full bredde ellers.
const TYPE_KORT_LABEL: Record<HurtigType, string> = {
  ut: "Ta ut",
  retur: "Retur",
  svinn: "Svinn",
  internbruk: "Intern",
  reserver: "Reserver",
};

// Samme prinsipp som i det tidligere Registrer-skjemaet: styrer hvilke
// kontekster som er relevante for hver type, så man ikke ved et uhell
// registrerer en kundeleveranse mot en svinn-kontekst eller omvendt.
const RELEVANTE_KONTEKST_TYPER: Record<HurtigType, KontekstType[]> = {
  ut: ["kunde", "prosjekt"],
  retur: ["retur", "kunde"],
  svinn: ["svinn"],
  internbruk: ["internbruk"],
  reserver: ["kunde", "prosjekt"],
};

interface KurvLinje {
  variantId: string;
  antall: number;
}

export function HurtigScreen() {
  const [varer, setVarer] = useState<Vare[]>([]);
  const [varianter, setVarianter] = useState<Variant[]>([]);
  const [lokasjoner, setLokasjoner] = useState<Lokasjon[]>([]);
  const [kontekster, setKontekster] = useState<Kontekst[]>([]);
  const [brukere, setBrukere] = useState<Bruker[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);
  const [beholdning, setBeholdning] = useState<BeholdningRad[]>([]);
  const [reservasjoner, setReservasjoner] = useState<Reservasjon[]>([]);
  const [lasterData, setLasterData] = useState(true);

  const [fase, setFase] = useState<"oppsett" | "skanning" | "kurv">("oppsett");
  const [type, setType] = useState<HurtigType>("ut");
  const [lokasjonId, setLokasjonId] = useState<string | null>(null);
  const [kontekstId, setKontekstId] = useState<string | null>(null);
  const [brukerId, setBrukerId] = useState<string | null>(null);
  const [reservertTilDato, setReservertTilDato] = useState("");
  const [oppsettFeil, setOppsettFeil] = useState<string | null>(null);
  const [reservasjonHandlingId, setReservasjonHandlingId] = useState<string | null>(null);

  const [tellerIØkt, setTellerIØkt] = useState(0);
  const [sisteMelding, setSisteMelding] = useState<string | null>(null);
  const [søk, setSøk] = useState("");
  const [valgtMerke, setValgtMerke] = useState<string | null>(null);
  const [valgtKategori, setValgtKategori] = useState<string>(ALLE_KATEGORIER);
  const [valgtVariantId, setValgtVariantId] = useState<string | null>(null);
  const [kameraÅpen, setKameraÅpen] = useState(false);

  const [kurv, setKurv] = useState<KurvLinje[]>([]);

  const lastData = useCallback(async () => {
    setLasterData(true);
    try {
      const [v, va, l, k, b, m, beh, res] = await Promise.all([
        listVarer(),
        listVarianter(),
        listLokasjoner(),
        listKontekster(),
        listBrukere(),
        listMerker(),
        hentBeholdning(),
        listReservasjoner("aktiv"),
      ]);
      setVarer(v);
      setVarianter(va);
      setLokasjoner(l);
      setKontekster(k);
      setBrukere(b);
      setMerker(m);
      setBeholdning(beh);
      setReservasjoner(res);
    } catch {
      setOppsettFeil("Kunne ikke hente data fra serveren. Sjekk at backend kjører.");
    } finally {
      setLasterData(false);
    }
  }, []);

  useEffect(() => {
    lastData();
  }, [lastData]);

  // Forhåndsvelg lokasjon når det bare finnes én, og forhåndsvelg sist brukte bruker.
  useEffect(() => {
    if (lokasjoner.length === 1 && !lokasjonId) setLokasjonId(lokasjoner[0].id);
  }, [lokasjoner, lokasjonId]);
  useEffect(() => {
    if (brukere.length === 0 || brukerId) return;
    // Forhåndsvelg den innloggede brukeren. Kan overstyres i feltet hvis man
    // tar ut på vegne av noen andre. Faller tilbake på sist brukte bruker.
    const innlogget = hentLagretBruker();
    if (innlogget && brukere.some((b) => b.id === innlogget.id)) {
      setBrukerId(innlogget.id);
      return;
    }
    const sistId = hentLagretVerdi(SISTE_BRUKER_NOKKEL);
    if (sistId && brukere.some((b) => b.id === sistId)) setBrukerId(sistId);
  }, [brukere, brukerId]);
  // Bytt av type nullstiller et kontekst-valg som ikke lenger passer (men kun
  // når det faktisk finnes et passende alternativ å falle tilbake på).
  useEffect(() => {
    if (!kontekstId) return;
    const relevante = RELEVANTE_KONTEKST_TYPER[type];
    const fortsattGyldig = kontekster.some((k) => k.id === kontekstId && relevante.includes(k.type));
    if (!fortsattGyldig && kontekster.some((k) => relevante.includes(k.type))) setKontekstId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const vareMap = useMemo(() => new Map(varer.map((v) => [v.id, v])), [varer]);
  const merkeMap = useMemo(() => new Map(merker.map((m) => [m.id, m])), [merker]);
  const variantMap = useMemo(() => new Map(varianter.map((v) => [v.id, v])), [varianter]);
  const lokasjonAlternativer = useMemo(
    () => lokasjoner.map((l) => ({ verdi: l.id, label: l.navn, undertekst: l.type })),
    [lokasjoner],
  );
  const kontekstAlternativer = useMemo(() => {
    const relevante = RELEVANTE_KONTEKST_TYPER[type];
    const filtrert = kontekster.filter((k) => relevante.includes(k.type));
    const kilde = filtrert.length > 0 ? filtrert : kontekster;
    return kilde.map((k) => ({ verdi: k.id, label: k.navn, undertekst: k.type }));
  }, [kontekster, type]);
  const brukerAlternativer = useMemo(
    () => brukere.map((b) => ({ verdi: b.id, label: b.navn, undertekst: b.rolle })),
    [brukere],
  );

  function startØkt() {
    setOppsettFeil(null);
    if (!lokasjonId || !kontekstId || !brukerId) {
      setOppsettFeil("Velg lokasjon, formål og bruker for å starte.");
      return;
    }
    lagreVerdi(SISTE_BRUKER_NOKKEL, brukerId);
    setTellerIØkt(0);
    setSisteMelding(null);
    setKurv([]);
    setFase("skanning");
  }

  function avsluttØkt() {
    if (kurv.length > 0) {
      Alert.alert(
        "Kurven er ikke tom",
        `Du har ${kurv.length} vare(r) i kurven som ikke er fullført. Avslutt likevel?`,
        [
          { text: "Avbryt", style: "cancel" },
          { text: "Avslutt økt", style: "destructive", onPress: () => gåTilOppsett() },
        ],
      );
      return;
    }
    gåTilOppsett();
  }

  function gåTilOppsett() {
    setFase("oppsett");
    setSøk("");
    setValgtMerke(null);
    setValgtKategori(ALLE_KATEGORIER);
    setKurv([]);
  }

  const kontekstNavn = kontekster.find((k) => k.id === kontekstId)?.navn ?? "?";
  const lokasjonNavn = lokasjoner.find((l) => l.id === lokasjonId)?.navn ?? "?";
  const brukerNavn = brukere.find((b) => b.id === brukerId)?.navn ?? "?";

  function leggIKurv(variantId: string, antall: number) {
    setKurv((forrige) => {
      const eksisterende = forrige.find((l) => l.variantId === variantId);
      if (eksisterende) {
        return forrige.map((l) => (l.variantId === variantId ? { ...l, antall: l.antall + antall } : l));
      }
      return [...forrige, { variantId, antall }];
    });
    const variant = variantMap.get(variantId);
    const navn = variant ? `${vareMap.get(variant.vareId)?.navn ?? "Ukjent vare"} — ${variant.sku}` : "";
    setSisteMelding(`🛒 Lagt i kurv: ${navn} — ${antall} stk`);
    setValgtVariantId(null);
  }

  function endreAntallIKurv(variantId: string, nyttAntall: number) {
    setKurv((forrige) => forrige.map((l) => (l.variantId === variantId ? { ...l, antall: nyttAntall } : l)));
  }

  function fjernFraKurv(variantId: string) {
    setKurv((forrige) => forrige.filter((l) => l.variantId !== variantId));
  }

  const kurvAntallTotalt = kurv.reduce((sum, l) => sum + l.antall, 0);

  function reservasjonNavn(r: Reservasjon) {
    const variant = variantMap.get(r.variantId);
    const vareNavn = variant ? vareMap.get(variant.vareId)?.navn : undefined;
    return `${vareNavn ?? "Ukjent vare"} — ${variant?.sku ?? "?"}`;
  }

  async function handleKansellerReservasjon(id: string) {
    setReservasjonHandlingId(id);
    try {
      await kansellerReservasjon(id);
      setReservasjoner(await listReservasjoner("aktiv"));
    } catch (err) {
      setOppsettFeil(err instanceof ApiFeil ? err.message : "Kunne ikke kansellere reservasjonen.");
    } finally {
      setReservasjonHandlingId(null);
    }
  }

  async function handleFullforReservasjon(id: string) {
    setReservasjonHandlingId(id);
    try {
      await fullforReservasjon(id);
      setReservasjoner(await listReservasjoner("aktiv"));
    } catch (err) {
      setOppsettFeil(err instanceof ApiFeil ? err.message : "Kunne ikke fullføre reservasjonen.");
    } finally {
      setReservasjonHandlingId(null);
    }
  }

  async function fullførOrdre() {
    const ikkeFullførte: KurvLinje[] = [];
    let feilmelding: string | null = null;
    let antallFullført = 0;

    for (const linje of kurv) {
      try {
        if (type === "reserver") {
          await opprettReservasjon({
            variantId: linje.variantId,
            lokasjonId: lokasjonId!,
            kontekstId: kontekstId!,
            brukerId: brukerId!,
            antall: linje.antall,
            ...(reservertTilDato.trim() ? { tilDato: reservertTilDato.trim() } : {}),
          });
        } else {
          await opprettBevegelse({
            variantId: linje.variantId,
            lokasjonId: lokasjonId!,
            kontekstId: kontekstId!,
            brukerId: brukerId!,
            type,
            antall: linje.antall,
          });
        }
        antallFullført += linje.antall;
      } catch (err) {
        ikkeFullførte.push(linje);
        if (!feilmelding) {
          feilmelding = err instanceof ApiFeil ? err.message : "Kunne ikke registrere denne linjen.";
        }
      }
    }

    setKurv(ikkeFullførte);
    setTellerIØkt((n) => n + antallFullført);
    try {
      setBeholdning(await hentBeholdning());
      if (type === "reserver") setReservasjoner(await listReservasjoner("aktiv"));
    } catch {
      // stille - påvirker kun "tilgjengelig"-hintet
    }

    if (ikkeFullførte.length === 0) {
      setSisteMelding(
        type === "reserver"
          ? `✓ Reservert: ${kurv.length} varelinjer, ${antallFullført} stk`
          : `✓ Ordre fullført: ${kurv.length} varelinjer, ${antallFullført} stk`,
      );
      setFase("skanning");
      return null;
    }
    return `${feilmelding ?? "Noen linjer feilet"} — ${ikkeFullførte.length} linje(r) ble stående igjen i kurven, resten ble registrert.`;
  }

  if (lasterData) {
    return (
      <View style={stiler.senterFyll}>
        <ActivityIndicator color={farger.primaer} />
      </View>
    );
  }

  if (fase === "oppsett") {
    return (
      <ScrollView style={stiler.rot} contentContainerStyle={stiler.oppsettInnhold}>
        <Text style={stiler.tittel}>Uttak</Text>
        <Text style={stiler.undertekst}>
          Den vanlige veien for å levere til, ta imot fra eller reservere for en kunde. Velg
          kunde/formål én gang, skann så vare etter vare — legg i kurv, og fullfør til slutt.
        </Text>

        <View style={stiler.typeRad}>
          {(Object.keys(TYPE_KORT_LABEL) as HurtigType[]).map((t) => (
            <TypeKnapp key={t} label={TYPE_KORT_LABEL[t]} aktiv={type === t} onPress={() => setType(t)} />
          ))}
        </View>

        {lokasjoner.length > 1 && (
          <VelgFelt label="Lokasjon" valgt={lokasjonId} alternativer={lokasjonAlternativer} onVelg={setLokasjonId} />
        )}
        <VelgFelt label="Formål" valgt={kontekstId} alternativer={kontekstAlternativer} onVelg={setKontekstId} />
        <VelgFelt label="Bruker" valgt={brukerId} alternativer={brukerAlternativer} onVelg={setBrukerId} />
        {type === "reserver" && (
          <TekstFelt
            label="Reservert til (valgfritt)"
            value={reservertTilDato}
            onChangeText={setReservertTilDato}
            placeholder="ÅÅÅÅ-MM-DD"
          />
        )}

        {oppsettFeil && <FeilBanner tekst={oppsettFeil} />}
        <Knapp tittel="Start" onPress={startØkt} />

        {type === "reserver" && (
          <View style={stiler.reservasjonSeksjon}>
            <Text style={stiler.seksjonsTittel}>Aktive reservasjoner</Text>
            {reservasjoner.length === 0 && <TomListeTekst tekst="Ingen aktive reservasjoner." />}
            {reservasjoner.map((r) => (
              <Kort key={r.id}>
                <View style={stiler.kurvLinjeHeader}>
                  <Miniatyr url={variantMap.get(r.variantId)?.bildeurl} bokstav={reservasjonNavn(r)} storrelse={32} />
                  <View style={stiler.modalHeaderTekst}>
                    <Text style={stiler.modalNavn}>{reservasjonNavn(r)}</Text>
                    <Text style={stiler.modalMerke}>
                      {lokasjoner.find((l) => l.id === r.lokasjonId)?.navn ?? "?"} ·{" "}
                      {kontekster.find((k) => k.id === r.kontekstId)?.navn ?? "?"}
                      {r.tilDato ? ` · til ${new Date(r.tilDato).toLocaleDateString("nb-NO")}` : ""}
                    </Text>
                  </View>
                  <Text style={stiler.reservertAntall}>{r.antall} stk</Text>
                </View>
                <View style={stiler.modalKnapper}>
                  <View style={stiler.modalKnapp}>
                    <Knapp
                      tittel="Fullfør"
                      onPress={() => handleFullforReservasjon(r.id)}
                      disabled={reservasjonHandlingId === r.id}
                      variant="sekundaer"
                    />
                  </View>
                  <View style={stiler.modalKnapp}>
                    <Knapp
                      tittel="Kanseller"
                      onPress={() => handleKansellerReservasjon(r.id)}
                      disabled={reservasjonHandlingId === r.id}
                      variant="sekundaer"
                    />
                  </View>
                </View>
              </Kort>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  if (fase === "kurv") {
    return (
      <KurvSkjerm
        kurv={kurv}
        type={type}
        kontekstNavn={kontekstNavn}
        vareMap={vareMap}
        variantMap={variantMap}
        merkeMap={merkeMap}
        beholdning={beholdning}
        lokasjonId={lokasjonId!}
        onEndreAntall={endreAntallIKurv}
        onFjern={fjernFraKurv}
        onTilbake={() => setFase("skanning")}
        onFullfør={fullførOrdre}
      />
    );
  }

  return (
    <View style={stiler.rot}>
      <View style={stiler.øktHeader}>
        <View style={stiler.øktInfo}>
          <Text style={stiler.øktTittel}>
            {TYPE_LABEL[type]} · {kontekstNavn}
          </Text>
          <Text style={stiler.øktUndertekst}>
            {lokasjonNavn} · {brukerNavn} · {tellerIØkt} fullført
          </Text>
        </View>
        <Pressable onPress={avsluttØkt}>
          <Text style={stiler.avsluttLenke}>Avslutt</Text>
        </Pressable>
      </View>

      {sisteMelding && (
        <View style={stiler.toast}>
          <Text style={stiler.toastTekst}>{sisteMelding}</Text>
        </View>
      )}

      <VariantGrid
        varer={varer}
        varianter={varianter}
        vareMap={vareMap}
        merkeMap={merkeMap}
        søk={søk}
        onSøkChange={setSøk}
        valgtMerke={valgtMerke}
        onValgtMerkeChange={setValgtMerke}
        valgtKategori={valgtKategori}
        onValgtKategoriChange={setValgtKategori}
        onVelgVariant={setValgtVariantId}
        onÅpneKamera={() => setKameraÅpen(true)}
        harBunnKurvbar={kurv.length > 0}
      />

      {kurv.length > 0 && (
        <Pressable style={stiler.kurvBar} onPress={() => setFase("kurv")}>
          <Text style={stiler.kurvBarTekst}>
            🛒 {kurv.length} varelinjer · {kurvAntallTotalt} stk
          </Text>
          <Text style={stiler.kurvBarLenke}>Se kurv ›</Text>
        </Pressable>
      )}

      {valgtVariantId && (
        <LeggIKurvModal
          variant={varianter.find((v) => v.id === valgtVariantId)!}
          vareMap={vareMap}
          merkeMap={merkeMap}
          type={type}
          lokasjonId={lokasjonId!}
          beholdning={beholdning}
          onLukk={() => setValgtVariantId(null)}
          onLeggTil={leggIKurv}
        />
      )}

      {kameraÅpen && (
        <KameraModal
          varianter={varianter}
          vareMap={vareMap}
          onLukk={() => setKameraÅpen(false)}
          onFunnet={(variantId) => {
            setKameraÅpen(false);
            setValgtVariantId(variantId);
          }}
        />
      )}
    </View>
  );
}

function TypeKnapp({ label, aktiv, onPress }: { label: string; aktiv: boolean; onPress: () => void }) {
  return (
    <Pressable style={[stiler.typeKnapp, aktiv && stiler.typeKnappAktiv]} onPress={onPress}>
      <Text style={[stiler.typeKnappTekst, aktiv && stiler.typeKnappTekstAktiv]}>{label}</Text>
    </Pressable>
  );
}

function VariantGrid({
  varer,
  varianter,
  vareMap,
  merkeMap,
  søk,
  onSøkChange,
  valgtMerke,
  onValgtMerkeChange,
  valgtKategori,
  onValgtKategoriChange,
  onVelgVariant,
  onÅpneKamera,
  harBunnKurvbar,
}: {
  varer: Vare[];
  varianter: Variant[];
  vareMap: Map<string, Vare>;
  merkeMap: Map<string, Merke>;
  søk: string;
  onSøkChange: (v: string) => void;
  valgtMerke: string | null;
  onValgtMerkeChange: (v: string | null) => void;
  onVelgVariant: (id: string) => void;
  onÅpneKamera: () => void;
  harBunnKurvbar: boolean;
  valgtKategori: string;
  onValgtKategoriChange: (k: string) => void;
}) {
  const merkeAlternativer = useMemo(() => {
    const idSet = new Set(varianter.map((v) => v.merkeId).filter((id): id is string => id !== null));
    return Array.from(merkeMap.values())
      .filter((m) => idSet.has(m.id))
      .sort((a, b) => a.navn.localeCompare(b.navn))
      .map((m) => ({ id: m.id, navn: m.navn, logoUrl: m.logoUrl }));
  }, [varianter, merkeMap]);
  const harUtenMerke = useMemo(() => varianter.some((v) => !v.merkeId), [varianter]);
  const kategoriAlternativer = useMemo(() => {
    const sett = new Set<string>();
    for (const v of varianter) {
      const kategori = vareMap.get(v.vareId)?.kategori;
      if (kategori) sett.add(kategori);
    }
    return Array.from(sett).sort((a, b) => a.localeCompare(b));
  }, [varianter, vareMap]);

  const filtrerte = useMemo(() => {
    const søkLav = søk.trim().toLowerCase();
    return varianter.filter((v) => {
      const vare = vareMap.get(v.vareId);
      const merkeNavn = v.merkeId ? merkeMap.get(v.merkeId)?.navn ?? null : null;
      if (valgtMerke === UTEN_MERKE && v.merkeId) return false;
      else if (valgtMerke && valgtMerke !== UTEN_MERKE && v.merkeId !== valgtMerke) return false;
      if (valgtKategori !== ALLE_KATEGORIER && vare?.kategori !== valgtKategori) return false;
      if (!søkLav) return true;
      return (
        vare?.navn.toLowerCase().includes(søkLav) ||
        v.sku.toLowerCase().includes(søkLav) ||
        merkeNavn?.toLowerCase().includes(søkLav)
      );
    });
  }, [varianter, vareMap, merkeMap, søk, valgtMerke, valgtKategori]);

  return (
    <FlatList
      style={stiler.grid}
      contentContainerStyle={[stiler.gridInnhold, harBunnKurvbar && stiler.gridInnholdMedKurvbar]}
      data={filtrerte}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={stiler.gridRad}
      ListHeaderComponent={
        <View style={stiler.gridHeader}>
          <TextInput
            style={stiler.søkInput}
            value={søk}
            onChangeText={onSøkChange}
            placeholder="Søk vare, SKU eller merke..."
          />
          <MerkeOgKategoriFilter
            idPrefiks="hurtig"
            merkeAlternativer={merkeAlternativer}
            harUtenMerke={harUtenMerke}
            valgtMerke={valgtMerke}
            onValgtMerkeChange={onValgtMerkeChange}
            kategoriAlternativer={kategoriAlternativer}
            valgtKategori={valgtKategori}
            onValgtKategoriChange={onValgtKategoriChange}
          />
          <Pressable style={stiler.kameraKnapp} onPress={onÅpneKamera}>
            <Text style={stiler.kameraKnappTekst}>📷 Finner du ikke varen? Ta bilde</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={<TomListeTekst tekst="Ingen varianter matcher søket." />}
      renderItem={({ item }) => {
        const vare = vareMap.get(item.vareId);
        return (
          <Pressable style={stiler.rute} onPress={() => onVelgVariant(item.id)}>
            <Miniatyr url={item.bildeurl} bokstav={vare?.navn ?? item.sku} storrelse={64} />
            <Text style={stiler.ruteNavn} numberOfLines={2}>
              {vare?.navn ?? "Ukjent"}
            </Text>
            <Text style={stiler.ruteSku} numberOfLines={1}>
              {item.sku}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function LeggIKurvModal({
  variant,
  vareMap,
  merkeMap,
  type,
  lokasjonId,
  beholdning,
  onLukk,
  onLeggTil,
}: {
  variant: Variant;
  vareMap: Map<string, Vare>;
  merkeMap: Map<string, Merke>;
  type: HurtigType;
  lokasjonId: string;
  beholdning: BeholdningRad[];
  onLukk: () => void;
  onLeggTil: (variantId: string, antall: number) => void;
}) {
  const [antall, setAntall] = useState(1);

  const vare = vareMap.get(variant.vareId);
  const navn = `${vare?.navn ?? "Ukjent vare"} — ${variant.sku}`;
  const merke = variant.merkeId ? merkeMap.get(variant.merkeId)?.navn ?? null : null;
  const beholdningRad = beholdning.find((r) => r.variantId === variant.id && r.lokasjonId === lokasjonId);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable style={stiler.modalBakgrunn} onPress={onLukk}>
        <Pressable style={stiler.modalKort} onPress={(e) => e.stopPropagation()}>
          <View style={stiler.modalHeader}>
            <Miniatyr url={variant.bildeurl} bokstav={vare?.navn ?? variant.sku} storrelse={64} />
            <View style={stiler.modalHeaderTekst}>
              <Text style={stiler.modalNavn}>{navn}</Text>
              {merke && <Text style={stiler.modalMerke}>{merke}</Text>}
            </View>
          </View>

          <AntallVelger
            verdi={antall}
            onChange={setAntall}
            tilgjengelig={type !== "retur" ? (beholdningRad?.tilgjengelig ?? 0) : undefined}
          />

          <View style={stiler.modalKnapper}>
            <View style={stiler.modalKnapp}>
              <Knapp tittel="Avbryt" onPress={onLukk} variant="sekundaer" />
            </View>
            <View style={stiler.modalKnapp}>
              <Knapp tittel={`Legg i kurv (${antall} stk)`} onPress={() => onLeggTil(variant.id, antall)} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function KurvSkjerm({
  kurv,
  type,
  kontekstNavn,
  vareMap,
  variantMap,
  merkeMap,
  beholdning,
  lokasjonId,
  onEndreAntall,
  onFjern,
  onTilbake,
  onFullfør,
}: {
  kurv: KurvLinje[];
  type: HurtigType;
  kontekstNavn: string;
  vareMap: Map<string, Vare>;
  variantMap: Map<string, Variant>;
  merkeMap: Map<string, Merke>;
  beholdning: BeholdningRad[];
  lokasjonId: string;
  onEndreAntall: (variantId: string, antall: number) => void;
  onFjern: (variantId: string) => void;
  onTilbake: () => void;
  onFullfør: () => Promise<string | null>;
}) {
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const totalAntall = kurv.reduce((sum, l) => sum + l.antall, 0);
  const { totalVerdiOre, antallMedVerdi } = kurv.reduce(
    (acc, l) => {
      const variant = variantMap.get(l.variantId);
      if (variant?.verdiOre != null) {
        acc.totalVerdiOre += variant.verdiOre * l.antall;
        acc.antallMedVerdi += l.antall;
      }
      return acc;
    },
    { totalVerdiOre: 0, antallMedVerdi: 0 },
  );

  async function bekreft() {
    setFeil(null);
    setLaster(true);
    const resultat = await onFullfør();
    setLaster(false);
    if (resultat) setFeil(resultat);
  }

  return (
    <View style={stiler.rot}>
      <View style={stiler.øktHeader}>
        <View style={stiler.øktInfo}>
          <Text style={stiler.øktTittel}>Kurv · {kontekstNavn}</Text>
          <Text style={stiler.øktUndertekst}>
            {kurv.length} varelinjer · {totalAntall} stk
            {antallMedVerdi > 0 && ` · ${formatterKroner(totalVerdiOre)}`}
          </Text>
        </View>
        <Pressable onPress={onTilbake}>
          <Text style={stiler.kurvBarLenke}>‹ Fortsett å skanne</Text>
        </Pressable>
      </View>

      <FlatList
        style={stiler.grid}
        contentContainerStyle={stiler.kurvListeInnhold}
        data={kurv}
        keyExtractor={(item) => item.variantId}
        ListEmptyComponent={<TomListeTekst tekst="Kurven er tom." />}
        renderItem={({ item }) => {
          const variant = variantMap.get(item.variantId);
          const vare = variant ? vareMap.get(variant.vareId) : undefined;
          const merke = variant?.merkeId ? merkeMap.get(variant.merkeId)?.navn : undefined;
          const beholdningRad = variant
            ? beholdning.find((r) => r.variantId === variant.id && r.lokasjonId === lokasjonId)
            : undefined;
          return (
            <View style={stiler.kurvLinje}>
              <View style={stiler.kurvLinjeHeader}>
                <Miniatyr url={variant?.bildeurl} bokstav={vare?.navn ?? "?"} storrelse={48} />
                <View style={stiler.modalHeaderTekst}>
                  <Text style={stiler.modalNavn}>
                    {vare?.navn ?? "Ukjent vare"} — {variant?.sku ?? "?"}
                  </Text>
                  {merke && <Text style={stiler.modalMerke}>{merke}</Text>}
                </View>
                <Pressable onPress={() => onFjern(item.variantId)}>
                  <Text style={stiler.fjernLenke}>Fjern</Text>
                </Pressable>
              </View>
              <AntallVelger
                verdi={item.antall}
                onChange={(v) => onEndreAntall(item.variantId, v)}
                tilgjengelig={type !== "retur" ? (beholdningRad?.tilgjengelig ?? 0) : undefined}
              />
            </View>
          );
        }}
      />

      <View style={stiler.kurvBunn}>
        {feil && <FeilBanner tekst={feil} />}
        <Knapp
          tittel={
            laster
              ? "Fullfører..."
              : type === "reserver"
                ? `Reserver (${totalAntall} stk)`
                : `Fullfør ordre (${totalAntall} stk)`
          }
          onPress={bekreft}
          disabled={laster || kurv.length === 0}
        />
      </View>
    </View>
  );
}

function KameraModal({
  varianter,
  vareMap,
  onLukk,
  onFunnet,
}: {
  varianter: Variant[];
  vareMap: Map<string, Vare>;
  onLukk: () => void;
  onFunnet: (variantId: string) => void;
}) {
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<VariantGjenkjenningResultat | null>(null);

  async function taBilde() {
    const tillatelse = await ImagePicker.requestCameraPermissionsAsync();
    if (!tillatelse.granted) {
      Alert.alert("Kamera-tilgang kreves", "ARTKL trenger tilgang til kamera for å fotografere varer.");
      return;
    }
    const valg = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (valg.canceled || !valg.assets[0].base64) return;

    setFeil(null);
    setResultat(null);
    setLaster(true);
    try {
      const svar = await gjenkjennVariant(valg.assets[0].base64, "image/jpeg");
      setResultat(svar);
      if (svar.variantId && svar.kandidater.length === 1) {
        onFunnet(svar.variantId);
      }
    } catch (err) {
      if (err instanceof ApiFeil && err.status === 503) {
        setFeil("Bildegjenkjenning er ikke konfigurert på serveren ennå (mangler API-nøkkel).");
      } else if (err instanceof ApiFeil) {
        setFeil(err.message);
      } else {
        setFeil("Kunne ikke koble til serveren.");
      }
    } finally {
      setLaster(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable style={stiler.modalBakgrunn} onPress={onLukk}>
        <Pressable style={stiler.modalKort} onPress={(e) => e.stopPropagation()}>
          <Text style={stiler.modalNavn}>Ta bilde av varen</Text>
          <Knapp tittel="Åpne kamera" onPress={taBilde} disabled={laster} variant="sekundaer" />

          {feil && <FeilBanner tekst={feil} />}

          {resultat && !resultat.variantId && resultat.kandidater.length > 1 && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.modalMerke}>Flere mulige treff — velg riktig variant:</Text>
              {resultat.kandidater.map((k) => (
                <Pressable
                  key={k.id}
                  style={stiler.kandidatRad}
                  onPress={() => onFunnet(k.id)}
                >
                  <Text style={stiler.ruteNavn}>{k.navn}</Text>
                  <Text style={stiler.ruteSku}>{k.sku}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {resultat?.nyVariant && (
            <FeilBanner tekst="Ingen treff — dette ser ut som en ny variant. Opprett den under Varer-fanen først." />
          )}

          <Knapp tittel="Lukk" onPress={onLukk} variant="sekundaer" disabled={laster} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const stiler = StyleSheet.create({
  rot: {
    flex: 1,
    backgroundColor: "#fff",
  },
  senterFyll: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  oppsettInnhold: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
  },
  tittel: {
    fontSize: 24,
    fontWeight: "700",
  },
  undertekst: {
    fontSize: 14,
    color: farger.undertekst,
  },
  typeRad: {
    flexDirection: "row",
    gap: 6,
  },
  typeKnapp: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  typeKnappAktiv: {
    backgroundColor: farger.primaer,
  },
  typeKnappTekst: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
    textAlign: "center",
  },
  typeKnappTekstAktiv: {
    color: "#fff",
  },
  reservasjonSeksjon: {
    gap: 10,
    marginTop: 8,
  },
  seksjonsTittel: {
    fontSize: 16,
    fontWeight: "700",
    color: farger.tekst,
  },
  reservertAntall: {
    fontSize: 15,
    fontWeight: "700",
    color: farger.advarselKant,
  },
  øktHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  øktInfo: {
    flex: 1,
  },
  øktTittel: {
    fontSize: 17,
    fontWeight: "700",
    color: farger.tekst,
  },
  øktUndertekst: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  avsluttLenke: {
    fontSize: 14,
    fontWeight: "600",
    color: farger.feilTekst,
  },
  toast: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#eaf6ee",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toastTekst: {
    color: farger.primaer,
    fontWeight: "600",
    fontSize: 13,
  },
  grid: {
    flex: 1,
  },
  gridInnhold: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  gridInnholdMedKurvbar: {
    paddingBottom: 76,
  },
  gridHeader: {
    paddingHorizontal: 4,
    gap: 8,
    marginBottom: 8,
  },
  søkInput: {
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  kameraKnapp: {
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#eef3f0",
    borderRadius: 8,
  },
  kameraKnappTekst: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.primaer,
  },
  gridRad: {
    gap: 8,
    marginBottom: 8,
  },
  rute: {
    flex: 1 / 3,
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  ruteNavn: {
    fontSize: 12,
    fontWeight: "600",
    color: farger.tekst,
    textAlign: "center",
  },
  ruteSku: {
    fontSize: 10,
    color: "#999",
    textAlign: "center",
  },
  kurvBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: farger.primaer,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kurvBarTekst: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  kurvBarLenke: {
    color: farger.primaer,
    fontWeight: "600",
    fontSize: 13,
  },
  kurvListeInnhold: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  kurvLinje: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  kurvLinjeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fjernLenke: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.feilTekst,
  },
  kurvBunn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  modalBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalKort: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalHeaderTekst: {
    flex: 1,
  },
  modalNavn: {
    fontSize: 17,
    fontWeight: "700",
    color: farger.tekst,
  },
  modalMerke: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  modalKnapper: {
    flexDirection: "row",
    gap: 10,
  },
  modalKnapp: {
    flex: 1,
  },
  kandidatListe: {
    gap: 8,
  },
  kandidatRad: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#eee",
  },
});
