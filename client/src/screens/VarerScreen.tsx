import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { taBilde, type KomprimertBilde } from "../lib/bilde";
import { hentLagretBruker } from "../lib/auth";
import { BildeVelger } from "../components/BildeVelger";
import { KATEGORI_ALTERNATIVER } from "../lib/kategorier";
import {
  ApiFeil,
  gjenkjennVariant,
  lastOppBilde,
  listBevegelser,
  listBrukere,
  listKontekster,
  listLeverandorer,
  listLokasjoner,
  listMerker,
  listVarer,
  listVarianter,
  oppdaterVare,
  oppdaterVariant,
  opprettBevegelse,
  opprettMerke,
  opprettVare,
  opprettVariant,
} from "../api";
import { krTilOre, oreTilKrTekst } from "../lib/valuta";
import type {
  Bevegelse,
  Bruker,
  Kontekst,
  Leverandor,
  Lokasjon,
  Merke,
  Vare,
  Variant,
  VariantGjenkjenningResultat,
} from "../types";
import {
  farger,
  FeilBanner,
  Knapp,
  Kort,
  Miniatyr,
  Sammenleggbar,
  TekstFelt,
  VelgFelt,
} from "../components/ui";

type MerkeAlternativ = { verdi: string; label: string; bilde?: string | null };

// Lager en lesbar SKU-stamme av artikkelnavnet: "Vinglass Rød" -> "VINGLASS-ROD".
function lagSkuBase(navn: string): string {
  const rens = navn
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 14);
  return rens || "ART";
}

function tilfeldigSuffiks(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function VarerScreen() {
  const [leverandorer, setLeverandorer] = useState<Leverandor[]>([]);
  const [varer, setVarer] = useState<Vare[]>([]);
  const [varianter, setVarianter] = useState<Variant[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);
  const [lokasjoner, setLokasjoner] = useState<Lokasjon[]>([]);
  const [kontekster, setKontekster] = useState<Kontekst[]>([]);
  const [brukere, setBrukere] = useState<Bruker[]>([]);
  const [innBevegelser, setInnBevegelser] = useState<Bevegelse[]>([]);
  const [listeFeil, setListeFeil] = useState<string | null>(null);
  const [apen, setApen] = useState<"varemottak" | "ny" | "rediger" | null>("ny");

  const lastInn = useCallback(async () => {
    try {
      const [l, v, va, m, lo, k, b, bev] = await Promise.all([
        listLeverandorer(),
        listVarer(),
        listVarianter(),
        listMerker(),
        listLokasjoner(),
        listKontekster(),
        listBrukere(),
        listBevegelser(),
      ]);
      setLeverandorer(l);
      setVarer(v);
      setVarianter(va);
      setMerker(m);
      setLokasjoner(lo);
      setKontekster(k);
      setBrukere(b);
      setInnBevegelser(bev.filter((x) => x.type === "inn").slice(0, 10));
    } catch {
      setListeFeil("Kunne ikke hente data. Sjekk at backend kjører.");
    }
  }, []);

  useEffect(() => {
    lastInn();
  }, [lastInn]);

  function toggle(seksjon: "varemottak" | "ny" | "rediger") {
    setApen((n) => (n === seksjon ? null : seksjon));
  }

  const merkeAlternativer = useMemo<MerkeAlternativ[]>(
    () => merker.map((m) => ({ verdi: m.id, label: m.navn, bilde: m.logoUrl })),
    [merker],
  );

  return (
    <ScrollView
      style={stiler.rot}
      contentContainerStyle={stiler.scrollInnhold}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={stiler.tittel}>Artikkelstyring</Text>
      <Text style={stiler.undertekst}>
        Ta imot varemottak, opprett nye artikler, eller rediger eksisterende.
      </Text>

      {listeFeil && <FeilBanner tekst={listeFeil} />}

      <Sammenleggbar
        tittel="Registrer varemottak"
        undertekst="Antall inn på lager for en artikkel som finnes"
        apen={apen === "varemottak"}
        onToggle={() => toggle("varemottak")}
      >
        <VaremottakSkjema
          varer={varer}
          varianter={varianter}
          lokasjoner={lokasjoner}
          kontekster={kontekster}
          brukere={brukere}
          innBevegelser={innBevegelser}
          onRegistrert={lastInn}
        />
      </Sammenleggbar>

      <Sammenleggbar
        tittel="Ny artikkel"
        undertekst="Navn, kategori, leverandør, pris og bilde i ett steg"
        apen={apen === "ny"}
        onToggle={() => toggle("ny")}
      >
        <NyArtikkelSkjema
          leverandorer={leverandorer}
          merkeAlternativer={merkeAlternativer}
          onOpprettet={lastInn}
        />
      </Sammenleggbar>

      <Sammenleggbar
        tittel="Rediger artikkel"
        undertekst="Endre en eksisterende artikkel, eller legg til varianter"
        apen={apen === "rediger"}
        onToggle={() => toggle("rediger")}
      >
        <RedigerArtikkelSkjema
          varer={varer}
          varianter={varianter}
          leverandorer={leverandorer}
          merkeAlternativer={merkeAlternativer}
          onLagret={lastInn}
        />
      </Sammenleggbar>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Registrer varemottak
// ---------------------------------------------------------------------------

function VaremottakSkjema({
  varer,
  varianter,
  lokasjoner,
  kontekster,
  brukere,
  innBevegelser,
  onRegistrert,
}: {
  varer: Vare[];
  varianter: Variant[];
  lokasjoner: Lokasjon[];
  kontekster: Kontekst[];
  brukere: Bruker[];
  innBevegelser: Bevegelse[];
  onRegistrert: () => Promise<void>;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [lokasjonId, setLokasjonId] = useState<string | null>(null);
  const [brukerId, setBrukerId] = useState<string | null>(null);
  const [antall, setAntall] = useState("1");
  const [feil, setFeil] = useState<string | null>(null);
  const [suksess, setSuksess] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [kamera, setKamera] = useState(false);

  useEffect(() => {
    if (brukerId || brukere.length === 0) return;
    const innlogget = hentLagretBruker();
    if (innlogget && brukere.some((b) => b.id === innlogget.id)) setBrukerId(innlogget.id);
  }, [brukere, brukerId]);

  const vareMap = useMemo(() => new Map(varer.map((v) => [v.id, v])), [varer]);
  const variantAlternativer = useMemo(
    () =>
      varianter.map((v) => ({
        verdi: v.id,
        label: `${vareMap.get(v.vareId)?.navn ?? "Ukjent"} — ${v.sku}`,
        bilde: v.bildeurl,
      })),
    [varianter, vareMap],
  );
  const lokasjonAlternativer = useMemo(
    () => lokasjoner.map((l) => ({ verdi: l.id, label: l.navn, undertekst: l.type })),
    [lokasjoner],
  );
  // Varemottak bruker den skjulte system-kont="innkjop"-konteksten automatisk.
  const innkjopKontekstId = useMemo(
    () => kontekster.find((k) => k.type === "innkjop")?.id,
    [kontekster],
  );
  const brukerAlternativer = useMemo(
    () => brukere.map((b) => ({ verdi: b.id, label: b.navn, undertekst: b.rolle })),
    [brukere],
  );

  async function registrer() {
    setFeil(null);
    setSuksess(null);
    const antallTall = Number(antall);
    if (!variantId || !lokasjonId || !brukerId) {
      setFeil("Velg artikkel, lokasjon og bruker.");
      return;
    }
    if (!Number.isInteger(antallTall) || antallTall <= 0) {
      setFeil("Antall må være et positivt heltall.");
      return;
    }
    setLaster(true);
    try {
      await opprettBevegelse({
        variantId,
        lokasjonId,
        ...(innkjopKontekstId ? { kontekstId: innkjopKontekstId } : {}),
        brukerId,
        type: "inn",
        antall: antallTall,
      });
      setSuksess("Varemottak registrert.");
      setAntall("1");
      await onRegistrert();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke registrere varemottaket.");
    } finally {
      setLaster(false);
    }
  }

  function bevegelseNavn(b: Bevegelse) {
    const variant = varianter.find((v) => v.id === b.variantId);
    const navn = variant ? vareMap.get(variant.vareId)?.navn : undefined;
    return `${navn ?? "Ukjent"} — ${variant?.sku ?? "?"}`;
  }

  return (
    <View style={stiler.skjema}>
      <VelgFelt
        label="Artikkel"
        valgt={variantId}
        alternativer={variantAlternativer}
        onVelg={setVariantId}
        tomtekst={varianter.length === 0 ? "Ingen artikler ennå — opprett en først" : "Velg artikkel"}
      />
      <VelgFelt
        label="Lokasjon"
        valgt={lokasjonId}
        alternativer={lokasjonAlternativer}
        onVelg={setLokasjonId}
      />
      <VelgFelt label="Bruker" valgt={brukerId} alternativer={brukerAlternativer} onVelg={setBrukerId} />
      <TekstFelt label="Antall" value={antall} onChangeText={setAntall} keyboardType="numeric" />
      <Pressable style={stiler.kameraKnapp} onPress={() => setKamera(true)}>
        <Text style={stiler.kameraKnappTekst}>📷 Finner du ikke artikkelen? Ta bilde</Text>
      </Pressable>
      {feil && <FeilBanner tekst={feil} />}
      {suksess && <Text style={stiler.suksessTekst}>{suksess}</Text>}
      <Knapp tittel="Registrer varemottak" onPress={registrer} disabled={laster} />

      {innBevegelser.length > 0 && (
        <View style={stiler.liste}>
          <Text style={stiler.hjelpetekst}>Siste varemottak</Text>
          {innBevegelser.map((b) => (
            <Kort key={b.id}>
              <Text style={stiler.radTittel}>{bevegelseNavn(b)}</Text>
              <Text style={stiler.radUndertekst}>
                {b.antall} stk · {new Date(b.tidspunkt).toLocaleDateString("nb-NO")}
              </Text>
            </Kort>
          ))}
        </View>
      )}

      {kamera && (
        <VareKameraModal
          formaal="mottak"
          onLukk={() => setKamera(false)}
          onFunnetEksisterende={(id) => {
            setVariantId(id);
            setKamera(false);
          }}
          onForslagNyArtikkel={() => setKamera(false)}
        />
      )}
    </View>
  );
}

// Merke-dropdown med «+ Nytt merke» inline, så man slipper å bytte til Oppsett.
function MerkeVelger({
  merkeAlternativer,
  valgt,
  onVelg,
  onMerkeOpprettet,
}: {
  merkeAlternativer: MerkeAlternativ[];
  valgt: string | null;
  onVelg: (id: string | null) => void;
  onMerkeOpprettet: () => Promise<void>;
}) {
  const [visNy, setVisNy] = useState(false);
  const [navn, setNavn] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function opprett() {
    setFeil(null);
    if (!navn.trim()) {
      setFeil("Fyll ut merkenavn.");
      return;
    }
    setLaster(true);
    try {
      const m = await opprettMerke({ navn: navn.trim(), logoUrl: logoUrl.trim() || undefined });
      await onMerkeOpprettet();
      onVelg(m.id);
      setNavn("");
      setLogoUrl("");
      setVisNy(false);
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette merket.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <VelgFelt
        label="Merke (valgfritt)"
        valgt={valgt}
        alternativer={merkeAlternativer}
        onVelg={onVelg}
        tomtekst={merkeAlternativer.length === 0 ? "Ingen merker ennå" : "Velg merke"}
      />
      {visNy ? (
        <View style={stiler.nyMerkeBoks}>
          <TekstFelt
            label="Nytt merke — navn"
            value={navn}
            onChangeText={setNavn}
            placeholder="F.eks. Acme Events"
          />
          <TekstFelt
            label="Logo-URL (valgfritt)"
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://..."
          />
          {feil && <FeilBanner tekst={feil} />}
          <View style={stiler.knappRad}>
            <View style={stiler.knappRadCelle}>
              <Knapp
                tittel="Avbryt"
                onPress={() => setVisNy(false)}
                variant="sekundaer"
                disabled={laster}
              />
            </View>
            <View style={stiler.knappRadCelle}>
              <Knapp tittel="Opprett merke" onPress={opprett} disabled={laster} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setVisNy(true)}>
          <Text style={stiler.lenkeTekst}>+ Nytt merke</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ny artikkel (vare + første variant i ett)
// ---------------------------------------------------------------------------

function NyArtikkelSkjema({
  leverandorer,
  merkeAlternativer,
  onOpprettet,
}: {
  leverandorer: Leverandor[];
  merkeAlternativer: MerkeAlternativ[];
  onOpprettet: () => Promise<void>;
}) {
  const [navn, setNavn] = useState("");
  const [kategori, setKategori] = useState<string | null>(null);
  const [leverandorId, setLeverandorId] = useState<string | null>(null);
  const [pris, setPris] = useState("");
  const [merkeId, setMerkeId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [skuRort, setSkuRort] = useState(false);
  const [bildeurl, setBildeurl] = useState("");
  const [bildeLaster, setBildeLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [suksess, setSuksess] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [kamera, setKamera] = useState(false);
  const suffiks = useRef(tilfeldigSuffiks()).current;

  useEffect(() => {
    if (!skuRort) setSku(navn.trim() ? `${lagSkuBase(navn)}-${suffiks}` : "");
  }, [navn, skuRort, suffiks]);

  const leverandorAlternativer = useMemo(
    () => leverandorer.map((l) => ({ verdi: l.id, label: l.navn })),
    [leverandorer],
  );

  async function bildeValgt(bilde: KomprimertBilde) {
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      setBildeurl(url);
    } catch (err) {
      setFeil(err instanceof Error ? `Bildet feilet: ${err.message}` : "Kunne ikke laste opp bildet.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function opprett() {
    setFeil(null);
    setSuksess(null);
    if (!navn.trim() || !kategori || !leverandorId) {
      setFeil("Fyll ut navn, kategori og leverandør.");
      return;
    }
    if (!sku.trim()) {
      setFeil("SKU kan ikke være tom.");
      return;
    }
    const verdiOre = pris.trim() ? krTilOre(pris) : null;
    if (pris.trim() && verdiOre === null) {
      setFeil("Pris må være et gyldig beløp, f.eks. 149,00.");
      return;
    }
    setLaster(true);
    try {
      const vare = await opprettVare({ navn: navn.trim(), kategori, leverandorId });
      await opprettVariant({
        vareId: vare.id,
        sku: sku.trim(),
        ...(merkeId ? { merkeId } : {}),
        ...(verdiOre !== null ? { verdiOre } : {}),
        ...(bildeurl ? { bildeurl } : {}),
      });
      setSuksess(`«${vare.navn}» opprettet.`);
      setNavn("");
      setKategori(null);
      setPris("");
      setMerkeId(null);
      setSku("");
      setSkuRort(false);
      setBildeurl("");
      await onOpprettet();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette artikkelen.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.skjema}>
      <Pressable style={stiler.kameraKnapp} onPress={() => setKamera(true)}>
        <Text style={stiler.kameraKnappTekst}>🔍 Ta bilde for forslag til navn og bilde</Text>
      </Pressable>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="F.eks. Vinglass" />
      <VelgFelt
        label="Kategori"
        valgt={kategori}
        alternativer={KATEGORI_ALTERNATIVER}
        onVelg={setKategori}
        tomtekst="Velg kategori"
      />
      <VelgFelt
        label="Leverandør"
        valgt={leverandorId}
        alternativer={leverandorAlternativer}
        onVelg={setLeverandorId}
        tomtekst={
          leverandorer.length === 0 ? "Ingen leverandører — opprett i Oppsett" : "Velg leverandør"
        }
      />
      <TekstFelt
        label="Pris per enhet, kr (valgfritt)"
        value={pris}
        onChangeText={setPris}
        keyboardType="numeric"
        placeholder="F.eks. 149,00"
      />
      <MerkeVelger
        merkeAlternativer={merkeAlternativer}
        valgt={merkeId}
        onVelg={setMerkeId}
        onMerkeOpprettet={onOpprettet}
      />
      <TekstFelt
        label="SKU (autogenerert — kan endres)"
        value={sku}
        onChangeText={(t) => {
          setSku(t);
          setSkuRort(true);
        }}
      />
      <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
      {bildeurl ? <Miniatyr url={bildeurl} storrelse={64} /> : null}
      {feil && <FeilBanner tekst={feil} />}
      {suksess && <Text style={stiler.suksessTekst}>{suksess}</Text>}
      <Knapp tittel="Opprett artikkel" onPress={opprett} disabled={laster} />

      {kamera && (
        <VareKameraModal
          formaal="ny"
          onLukk={() => setKamera(false)}
          onFunnetEksisterende={() => setKamera(false)}
          onForslagNyArtikkel={(resultat, bildeUrl) => {
            setNavn(resultat.varetype);
            if (resultat.synligSku) {
              setSku(resultat.synligSku);
              setSkuRort(true);
            }
            if (bildeUrl) setBildeurl(bildeUrl);
            setKamera(false);
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rediger artikkel
// ---------------------------------------------------------------------------

function RedigerArtikkelSkjema({
  varer,
  varianter,
  leverandorer,
  merkeAlternativer,
  onLagret,
}: {
  varer: Vare[];
  varianter: Variant[];
  leverandorer: Leverandor[];
  merkeAlternativer: MerkeAlternativ[];
  onLagret: () => Promise<void>;
}) {
  const [valgtVareId, setValgtVareId] = useState<string | null>(null);
  const vare = varer.find((v) => v.id === valgtVareId) ?? null;

  const vareAlternativer = useMemo(
    () => varer.map((v) => ({ verdi: v.id, label: `${v.navn} · ${v.kategori}` })),
    [varer],
  );

  return (
    <View style={stiler.skjema}>
      <VelgFelt
        label="Velg artikkel"
        valgt={valgtVareId}
        alternativer={vareAlternativer}
        onVelg={setValgtVareId}
        tomtekst={varer.length === 0 ? "Ingen artikler ennå" : "Velg artikkel"}
      />
      {vare && (
        <ArtikkelRedigering
          key={vare.id}
          vare={vare}
          varianter={varianter.filter((v) => v.vareId === vare.id)}
          leverandorer={leverandorer}
          merkeAlternativer={merkeAlternativer}
          onLagret={onLagret}
        />
      )}
    </View>
  );
}

function ArtikkelRedigering({
  vare,
  varianter,
  leverandorer,
  merkeAlternativer,
  onLagret,
}: {
  vare: Vare;
  varianter: Variant[];
  leverandorer: Leverandor[];
  merkeAlternativer: MerkeAlternativ[];
  onLagret: () => Promise<void>;
}) {
  const [navn, setNavn] = useState(vare.navn);
  const [kategori, setKategori] = useState<string | null>(vare.kategori);
  const [leverandorId, setLeverandorId] = useState<string | null>(vare.leverandorId);
  const [feil, setFeil] = useState<string | null>(null);
  const [suksess, setSuksess] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);
  const [leggerTil, setLeggerTil] = useState(false);

  const leverandorAlternativer = useMemo(
    () => leverandorer.map((l) => ({ verdi: l.id, label: l.navn })),
    [leverandorer],
  );
  // Eldre data kan ha en kategori utenfor den faste lista - vis den likevel.
  const kategoriAlternativer = useMemo(() => {
    if (KATEGORI_ALTERNATIVER.some((k) => k.verdi === vare.kategori)) return KATEGORI_ALTERNATIVER;
    return [...KATEGORI_ALTERNATIVER, { verdi: vare.kategori, label: `${vare.kategori} (utenfor lista)` }];
  }, [vare.kategori]);

  async function lagreArtikkel() {
    setFeil(null);
    setSuksess(null);
    if (!navn.trim() || !kategori || !leverandorId) {
      setFeil("Navn, kategori og leverandør må være satt.");
      return;
    }
    setLaster(true);
    try {
      await oppdaterVare(vare.id, { navn: navn.trim(), kategori, leverandorId });
      setSuksess("Artikkel lagret.");
      await onLagret();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre artikkelen.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <TekstFelt label="Navn" value={navn} onChangeText={setNavn} />
      <VelgFelt
        label="Kategori"
        valgt={kategori}
        alternativer={kategoriAlternativer}
        onVelg={setKategori}
        tomtekst="Velg kategori"
      />
      <VelgFelt
        label="Leverandør"
        valgt={leverandorId}
        alternativer={leverandorAlternativer}
        onVelg={setLeverandorId}
        tomtekst="Velg leverandør"
      />
      {feil && <FeilBanner tekst={feil} />}
      {suksess && <Text style={stiler.suksessTekst}>{suksess}</Text>}
      <Knapp tittel="Lagre artikkel" onPress={lagreArtikkel} disabled={laster} />

      <Text style={stiler.underseksjon}>Varianter ({varianter.length})</Text>
      {varianter.map((v) => (
        <VariantRedigering
          key={v.id}
          variant={v}
          merkeAlternativer={merkeAlternativer}
          onLagret={onLagret}
        />
      ))}

      {leggerTil ? (
        <NyVariantMini
          vareId={vare.id}
          artikkelnavn={vare.navn}
          merkeAlternativer={merkeAlternativer}
          onFerdig={async () => {
            setLeggerTil(false);
            await onLagret();
          }}
          onAvbryt={() => setLeggerTil(false)}
        />
      ) : (
        <Knapp
          tittel="+ Legg til variant (størrelse/farge)"
          onPress={() => setLeggerTil(true)}
          variant="sekundaer"
        />
      )}
    </View>
  );
}

function VariantRedigering({
  variant,
  merkeAlternativer,
  onLagret,
}: {
  variant: Variant;
  merkeAlternativer: MerkeAlternativ[];
  onLagret: () => Promise<void>;
}) {
  const [merkeId, setMerkeId] = useState<string | null>(variant.merkeId);
  const [pris, setPris] = useState(oreTilKrTekst(variant.verdiOre));
  const [bildeurl, setBildeurl] = useState(variant.bildeurl ?? "");
  const [bildeLaster, setBildeLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [suksess, setSuksess] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function bildeValgt(bilde: KomprimertBilde) {
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      setBildeurl(url);
    } catch (err) {
      setFeil(err instanceof Error ? `Bildet feilet: ${err.message}` : "Opplasting feilet.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function lagre() {
    setFeil(null);
    setSuksess(null);
    const verdiOre = pris.trim() ? krTilOre(pris) : null;
    if (pris.trim() && verdiOre === null) {
      setFeil("Pris må være et gyldig beløp.");
      return;
    }
    setLaster(true);
    try {
      await oppdaterVariant(variant.id, {
        merkeId,
        verdiOre,
        bildeurl: bildeurl.trim() || null,
      });
      setSuksess("Variant lagret.");
      await onLagret();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre varianten.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <Kort>
      <View style={{ gap: 10 }}>
        <View style={stiler.variantRad}>
          <Miniatyr url={bildeurl || null} bokstav={variant.sku} storrelse={44} />
          <Text style={[stiler.radTittel, { flex: 1 }]}>SKU: {variant.sku}</Text>
        </View>
        <TekstFelt label="Pris per enhet, kr" value={pris} onChangeText={setPris} keyboardType="numeric" />
        <VelgFelt
          label="Merke"
          valgt={merkeId}
          alternativer={merkeAlternativer}
          onVelg={setMerkeId}
          tomtekst="Ingen merke"
        />
        <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
        {feil && <FeilBanner tekst={feil} />}
        {suksess && <Text style={stiler.suksessTekst}>{suksess}</Text>}
        <Knapp tittel="Lagre variant" onPress={lagre} disabled={laster} variant="sekundaer" />
      </View>
    </Kort>
  );
}

function NyVariantMini({
  vareId,
  artikkelnavn,
  merkeAlternativer,
  onFerdig,
  onAvbryt,
}: {
  vareId: string;
  artikkelnavn: string;
  merkeAlternativer: MerkeAlternativ[];
  onFerdig: () => Promise<void>;
  onAvbryt: () => void;
}) {
  const [sku, setSku] = useState(`${lagSkuBase(artikkelnavn)}-${tilfeldigSuffiks()}`);
  const [pris, setPris] = useState("");
  const [merkeId, setMerkeId] = useState<string | null>(null);
  const [bildeurl, setBildeurl] = useState("");
  const [bildeLaster, setBildeLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function bildeValgt(bilde: KomprimertBilde) {
    setBildeLaster(true);
    try {
      const { url } = await lastOppBilde(bilde.base64);
      setBildeurl(url);
    } catch (err) {
      setFeil(err instanceof Error ? `Bildet feilet: ${err.message}` : "Opplasting feilet.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function opprett() {
    setFeil(null);
    if (!sku.trim()) {
      setFeil("SKU kan ikke være tom.");
      return;
    }
    const verdiOre = pris.trim() ? krTilOre(pris) : null;
    if (pris.trim() && verdiOre === null) {
      setFeil("Pris må være et gyldig beløp.");
      return;
    }
    setLaster(true);
    try {
      await opprettVariant({
        vareId,
        sku: sku.trim(),
        ...(merkeId ? { merkeId } : {}),
        ...(verdiOre !== null ? { verdiOre } : {}),
        ...(bildeurl ? { bildeurl } : {}),
      });
      await onFerdig();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette varianten.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <Kort>
      <View style={{ gap: 10 }}>
        <Text style={stiler.radTittel}>Ny variant</Text>
        <TekstFelt label="SKU" value={sku} onChangeText={setSku} />
        <TekstFelt
          label="Pris per enhet, kr (valgfritt)"
          value={pris}
          onChangeText={setPris}
          keyboardType="numeric"
        />
        <VelgFelt
          label="Merke (valgfritt)"
          valgt={merkeId}
          alternativer={merkeAlternativer}
          onVelg={setMerkeId}
          tomtekst="Ingen merke"
        />
        <BildeVelger laster={bildeLaster} onValgt={bildeValgt} onFeil={setFeil} />
        {bildeurl ? <Miniatyr url={bildeurl} storrelse={48} /> : null}
        {feil && <FeilBanner tekst={feil} />}
        <View style={stiler.knappRad}>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Avbryt" onPress={onAvbryt} variant="sekundaer" disabled={laster} />
          </View>
          <View style={stiler.knappRadCelle}>
            <Knapp tittel="Legg til" onPress={opprett} disabled={laster} />
          </View>
        </View>
      </View>
    </Kort>
  );
}

// ---------------------------------------------------------------------------
// Bildegjenkjenning (AI) - foreslår navn/SKU/bilde
// ---------------------------------------------------------------------------

function VareKameraModal({
  formaal,
  onLukk,
  onFunnetEksisterende,
  onForslagNyArtikkel,
}: {
  formaal: "mottak" | "ny";
  onLukk: () => void;
  onFunnetEksisterende: (variantId: string) => void;
  onForslagNyArtikkel: (resultat: VariantGjenkjenningResultat, bildeUrl?: string) => void;
}) {
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<VariantGjenkjenningResultat | null>(null);
  const [bilde, setBilde] = useState<KomprimertBilde | null>(null);

  async function skannBilde() {
    setFeil(null);
    setResultat(null);
    let tatt: KomprimertBilde | null;
    try {
      tatt = await taBilde();
    } catch (err) {
      setFeil(
        err instanceof Error ? `Kunne ikke behandle bildet: ${err.message}` : "Kunne ikke behandle bildet.",
      );
      return;
    }
    if (!tatt) return;
    setBilde(tatt);

    setLaster(true);
    try {
      const svar = await gjenkjennVariant(tatt.base64, "image/jpeg");
      setResultat(svar);
      if (svar.variantId && svar.kandidater.length === 1) {
        onFunnetEksisterende(svar.variantId);
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

  async function brukForslag(r: VariantGjenkjenningResultat) {
    setLaster(true);
    try {
      let url: string | undefined;
      if (bilde) {
        try {
          url = (await lastOppBilde(bilde.base64)).url;
        } catch {
          /* fortsett uten bilde */
        }
      }
      onForslagNyArtikkel(r, url);
    } finally {
      setLaster(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable style={stiler.modalBakgrunn} onPress={onLukk}>
        <Pressable style={stiler.modalKort} onPress={(e) => e.stopPropagation()}>
          <Text style={stiler.modalTittel}>
            {formaal === "mottak" ? "Ta bilde av artikkelen" : "Ta bilde for forslag til ny artikkel"}
          </Text>
          <Knapp tittel="Åpne kamera" onPress={skannBilde} disabled={laster} variant="sekundaer" />

          {feil && <FeilBanner tekst={feil} />}

          {resultat && !resultat.variantId && resultat.kandidater.length > 1 && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.hjelpetekst}>Flere mulige treff — velg riktig:</Text>
              {resultat.kandidater.map((k) => (
                <Pressable
                  key={k.id}
                  style={stiler.kandidatRad}
                  onPress={() => onFunnetEksisterende(k.id)}
                >
                  <Text style={stiler.radTittel}>{k.navn}</Text>
                  <Text style={stiler.radUndertekst}>{k.sku}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {resultat?.nyVariant && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.hjelpetekst}>
                Ingen treff blant eksisterende artikler
                {formaal === "mottak" ? " — opprett den under «Ny artikkel»." : "."}
              </Text>
              <Text style={stiler.radTittel}>{resultat.varetype}</Text>
              <Text style={stiler.radUndertekst}>{resultat.beskrivelse}</Text>
              {resultat.synligSku && (
                <Text style={stiler.radUndertekst}>Synlig SKU: {resultat.synligSku}</Text>
              )}
              {formaal === "ny" && (
                <Knapp
                  tittel={bilde ? "Bruk forslag + bilde" : "Bruk forslag i skjemaet"}
                  onPress={() => brukForslag(resultat)}
                  disabled={laster}
                />
              )}
            </View>
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
  scrollInnhold: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  tittel: {
    fontSize: 24,
    fontWeight: "700",
  },
  undertekst: {
    fontSize: 14,
    color: "#888",
  },
  hjelpetekst: {
    fontSize: 13,
    color: "#888",
  },
  underseksjon: {
    fontSize: 13,
    fontWeight: "700",
    color: farger.undertekst,
    marginTop: 6,
  },
  suksessTekst: {
    color: farger.primaer,
    fontWeight: "600",
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
  skjema: {
    gap: 12,
  },
  liste: {
    gap: 8,
    marginTop: 4,
  },
  radTittel: {
    fontSize: 15,
    fontWeight: "600",
    color: farger.tekst,
  },
  radUndertekst: {
    fontSize: 13,
    color: "#888",
  },
  variantRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  knappRad: {
    flexDirection: "row",
    gap: 10,
  },
  knappRadCelle: {
    flex: 1,
  },
  nyMerkeBoks: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#eee",
  },
  lenkeTekst: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.primaer,
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
    gap: 14,
  },
  modalTittel: {
    fontSize: 17,
    fontWeight: "700",
    color: farger.tekst,
  },
});
