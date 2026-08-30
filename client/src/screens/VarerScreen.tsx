import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { taBilde, type KomprimertBilde } from "../lib/bilde";
import { hentLagretBruker } from "../lib/auth";
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
  oppdaterVariant,
  opprettBevegelse,
  opprettVare,
  opprettVariant,
} from "../api";
import { krTilOre, oreTilKrTekst, formatterKroner } from "../lib/valuta";
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
  SeksjonsTittel,
  TekstFelt,
  TomListeTekst,
  VelgFelt,
} from "../components/ui";

function erGyldigUrl(verdi: string): boolean {
  try {
    new URL(verdi);
    return true;
  } catch {
    return false;
  }
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

  const [vareNavn, setVareNavn] = useState("");
  const [vareKategori, setVareKategori] = useState("");
  const [vareLeverandorId, setVareLeverandorId] = useState<string | null>(null);
  const [vareFeil, setVareFeil] = useState<string | null>(null);
  const [vareLaster, setVareLaster] = useState(false);

  const [variantVareId, setVariantVareId] = useState<string | null>(null);
  const [variantSku, setVariantSku] = useState("");
  const [variantMerkeId, setVariantMerkeId] = useState<string | null>(null);
  const [variantVerdi, setVariantVerdi] = useState("");
  const [variantBildeurl, setVariantBildeurl] = useState("");
  const [variantBildeLaster, setVariantBildeLaster] = useState(false);
  const [variantFeil, setVariantFeil] = useState<string | null>(null);
  const [variantLaster, setVariantLaster] = useState(false);

  const [mottakVariantId, setMottakVariantId] = useState<string | null>(null);
  const [mottakLokasjonId, setMottakLokasjonId] = useState<string | null>(null);
  const [mottakKontekstId, setMottakKontekstId] = useState<string | null>(null);
  const [mottakBrukerId, setMottakBrukerId] = useState<string | null>(null);
  const [mottakAntall, setMottakAntall] = useState("1");
  const [mottakFeil, setMottakFeil] = useState<string | null>(null);
  const [mottakSuksess, setMottakSuksess] = useState<string | null>(null);
  const [mottakLaster, setMottakLaster] = useState(false);

  const [redigerVariant, setRedigerVariant] = useState<Variant | null>(null);
  const [listeFeil, setListeFeil] = useState<string | null>(null);
  const [kameraFormaal, setKameraFormaal] = useState<"mottak" | "ny" | null>(null);

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
      setListeFeil("Kunne ikke hente varer. Sjekk at backend kjører.");
    }
  }, []);

  useEffect(() => {
    lastInn();
  }, [lastInn]);

  // Forhåndsvelg innlogget bruker som mottaker av varemottak (kan overstyres).
  useEffect(() => {
    if (mottakBrukerId || brukere.length === 0) return;
    const innlogget = hentLagretBruker();
    if (innlogget && brukere.some((b) => b.id === innlogget.id)) setMottakBrukerId(innlogget.id);
  }, [brukere, mottakBrukerId]);

  const leverandorAlternativer = useMemo(
    () => leverandorer.map((l) => ({ verdi: l.id, label: l.navn })),
    [leverandorer],
  );
  const vareAlternativer = useMemo(() => varer.map((v) => ({ verdi: v.id, label: v.navn })), [varer]);
  const vareMap = useMemo(() => new Map(varer.map((v) => [v.id, v])), [varer]);
  const merkeMap = useMemo(() => new Map(merker.map((m) => [m.id, m])), [merker]);
  const merkeAlternativer = useMemo(
    () => merker.map((m) => ({ verdi: m.id, label: m.navn, bilde: m.logoUrl })),
    [merker],
  );
  const eksisterendeVariantAlternativer = useMemo(
    () =>
      varianter.map((v) => ({
        verdi: v.id,
        label: `${vareMap.get(v.vareId)?.navn ?? "Ukjent vare"} — ${v.sku}`,
        bilde: v.bildeurl,
      })),
    [varianter, vareMap],
  );
  const lokasjonAlternativer = useMemo(
    () => lokasjoner.map((l) => ({ verdi: l.id, label: l.navn, undertekst: l.type })),
    [lokasjoner],
  );
  // Kun innkjøp-kontekster er relevante ved varemottak - samme prinsipp brukt
  // i Ta ut/Retur og det gamle Registrer-skjemaet.
  const innkjopKontekstAlternativer = useMemo(() => {
    const filtrert = kontekster.filter((k) => k.type === "innkjop");
    const kilde = filtrert.length > 0 ? filtrert : kontekster;
    return kilde.map((k) => ({ verdi: k.id, label: k.navn, undertekst: k.type }));
  }, [kontekster]);
  const brukerAlternativer = useMemo(
    () => brukere.map((b) => ({ verdi: b.id, label: b.navn, undertekst: b.rolle })),
    [brukere],
  );

  async function registrerVaremottak() {
    setMottakFeil(null);
    setMottakSuksess(null);
    const antallTall = Number(mottakAntall);
    if (!mottakVariantId || !mottakLokasjonId || !mottakKontekstId || !mottakBrukerId) {
      setMottakFeil("Velg vare, lokasjon, formål og bruker.");
      return;
    }
    if (!Number.isInteger(antallTall) || antallTall <= 0) {
      setMottakFeil("Antall må være et positivt heltall.");
      return;
    }

    setMottakLaster(true);
    try {
      await opprettBevegelse({
        variantId: mottakVariantId,
        lokasjonId: mottakLokasjonId,
        kontekstId: mottakKontekstId,
        brukerId: mottakBrukerId,
        type: "inn",
        antall: antallTall,
      });
      setMottakSuksess("Varemottak registrert.");
      setMottakAntall("1");
      await lastInn();
    } catch (err) {
      setMottakFeil(err instanceof ApiFeil ? err.message : "Kunne ikke registrere varemottaket.");
    } finally {
      setMottakLaster(false);
    }
  }

  async function leggTilVare() {
    setVareFeil(null);
    if (!vareNavn.trim() || !vareKategori.trim() || !vareLeverandorId) {
      setVareFeil("Fyll ut navn, kategori og leverandør.");
      return;
    }
    setVareLaster(true);
    try {
      await opprettVare({ navn: vareNavn.trim(), kategori: vareKategori.trim(), leverandorId: vareLeverandorId });
      setVareNavn("");
      setVareKategori("");
      await lastInn();
    } catch (err) {
      setVareFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette vare.");
    } finally {
      setVareLaster(false);
    }
  }

  async function leggTilVariant() {
    setVariantFeil(null);
    if (!variantVareId || !variantSku.trim()) {
      setVariantFeil("Velg vare og fyll ut SKU.");
      return;
    }
    const bildeurl = variantBildeurl.trim();
    if (bildeurl && !erGyldigUrl(bildeurl)) {
      setVariantFeil("Bilde-URL må være en gyldig lenke (https://...).");
      return;
    }
    const verdiOre = variantVerdi.trim() ? krTilOre(variantVerdi) : null;
    if (variantVerdi.trim() && verdiOre === null) {
      setVariantFeil("Verdi må være et gyldig beløp, f.eks. 149,00.");
      return;
    }

    setVariantLaster(true);
    try {
      await opprettVariant({
        vareId: variantVareId,
        sku: variantSku.trim(),
        ...(variantMerkeId ? { merkeId: variantMerkeId } : {}),
        ...(verdiOre !== null ? { verdiOre } : {}),
        ...(bildeurl ? { bildeurl } : {}),
      });
      setVariantSku("");
      setVariantMerkeId(null);
      setVariantVerdi("");
      setVariantBildeurl("");
      await lastInn();
    } catch (err) {
      setVariantFeil(err instanceof ApiFeil ? err.message : "Kunne ikke opprette variant.");
    } finally {
      setVariantLaster(false);
    }
  }

  async function taVariantbilde() {
    setVariantFeil(null);
    setVariantBildeLaster(true);
    try {
      const bilde = await taBilde();
      if (!bilde) return;
      const { url } = await lastOppBilde(bilde.base64);
      setVariantBildeurl(url);
    } catch (err) {
      setVariantFeil(
        err instanceof Error ? `Bildet feilet: ${err.message}` : "Kunne ikke laste opp bildet. Prøv igjen.",
      );
    } finally {
      setVariantBildeLaster(false);
    }
  }

  function innBevegelseNavn(b: Bevegelse) {
    const variant = varianter.find((v) => v.id === b.variantId);
    const vareNavn = variant ? vareMap.get(variant.vareId)?.navn : undefined;
    return `${vareNavn ?? "Ukjent vare"} — ${variant?.sku ?? "?"}`;
  }

  return (
    <ScrollView style={stiler.rot} contentContainerStyle={stiler.scrollInnhold}>
      <Text style={stiler.tittel}>Artikkelstyring</Text>
      <Text style={stiler.undertekst}>
        Ta imot varemottak for kjente artikler, eller registrer helt nye.
      </Text>

      {listeFeil && <FeilBanner tekst={listeFeil} />}

      <SeksjonsTittel>Registrer varemottak</SeksjonsTittel>
      <Text style={stiler.hjelpetekst}>For en artikkel som allerede finnes — antall som kommer inn på lager.</Text>
      <View style={stiler.skjema}>
        <VelgFelt
          label="Vare/variant"
          valgt={mottakVariantId}
          alternativer={eksisterendeVariantAlternativer}
          onVelg={setMottakVariantId}
          tomtekst={varianter.length === 0 ? "Ingen varianter — opprett en under først" : "Velg vare"}
        />
        <VelgFelt
          label="Lokasjon"
          valgt={mottakLokasjonId}
          alternativer={lokasjonAlternativer}
          onVelg={setMottakLokasjonId}
        />
        <VelgFelt
          label="Formål"
          valgt={mottakKontekstId}
          alternativer={innkjopKontekstAlternativer}
          onVelg={setMottakKontekstId}
        />
        <VelgFelt label="Bruker" valgt={mottakBrukerId} alternativer={brukerAlternativer} onVelg={setMottakBrukerId} />
        <TekstFelt label="Antall" value={mottakAntall} onChangeText={setMottakAntall} keyboardType="numeric" />
        <Pressable style={stiler.kameraKnapp} onPress={() => setKameraFormaal("mottak")}>
          <Text style={stiler.kameraKnappTekst}>📷 Finner du ikke varen? Ta bilde</Text>
        </Pressable>
        {mottakFeil && <FeilBanner tekst={mottakFeil} />}
        {mottakSuksess && <Text style={stiler.suksessTekst}>{mottakSuksess}</Text>}
        <Knapp tittel="Registrer varemottak" onPress={registrerVaremottak} disabled={mottakLaster} />
      </View>

      {innBevegelser.length > 0 && (
        <View style={stiler.liste}>
          <Text style={stiler.hjelpetekst}>Siste varemottak</Text>
          {innBevegelser.map((b) => (
            <Kort key={b.id}>
              <Text style={stiler.radTittel}>{innBevegelseNavn(b)}</Text>
              <Text style={stiler.radUndertekst}>
                {b.antall} stk · {new Date(b.tidspunkt).toLocaleDateString("nb-NO")}
              </Text>
            </Kort>
          ))}
        </View>
      )}

      <SeksjonsTittel>Ny vare</SeksjonsTittel>
      <Pressable style={stiler.kameraKnapp} onPress={() => setKameraFormaal("ny")}>
        <Text style={stiler.kameraKnappTekst}>📷 Ta bilde for forslag til navn/SKU</Text>
      </Pressable>
      <View style={stiler.skjema}>
        <TekstFelt label="Navn" value={vareNavn} onChangeText={setVareNavn} placeholder="F.eks. Kaffekopp" />
        <TekstFelt
          label="Kategori"
          value={vareKategori}
          onChangeText={setVareKategori}
          placeholder="F.eks. Servise"
        />
        <VelgFelt
          label="Leverandør"
          valgt={vareLeverandorId}
          alternativer={leverandorAlternativer}
          onVelg={setVareLeverandorId}
          tomtekst={leverandorer.length === 0 ? "Ingen leverandører — opprett en i Oppsett" : "Velg leverandør"}
        />
        {vareFeil && <FeilBanner tekst={vareFeil} />}
        <Knapp tittel="Legg til vare" onPress={leggTilVare} disabled={vareLaster} variant="sekundaer" />
      </View>

      <View style={stiler.liste}>
        {varer.length === 0 ? (
          <TomListeTekst tekst="Ingen varer registrert ennå." />
        ) : (
          varer.map((v) => (
            <Kort key={v.id}>
              <Text style={stiler.radTittel}>{v.navn}</Text>
              <Text style={stiler.radUndertekst}>{v.kategori}</Text>
            </Kort>
          ))
        )}
      </View>

      <SeksjonsTittel>Ny variant</SeksjonsTittel>
      <View style={stiler.skjema}>
        <VelgFelt
          label="Vare"
          valgt={variantVareId}
          alternativer={vareAlternativer}
          onVelg={setVariantVareId}
          tomtekst={varer.length === 0 ? "Ingen varer — opprett en over først" : "Velg vare"}
        />
        <TekstFelt label="SKU" value={variantSku} onChangeText={setVariantSku} placeholder="F.eks. KOPP-RED-01" />
        <VelgFelt
          label="Merke (valgfritt)"
          valgt={variantMerkeId}
          alternativer={merkeAlternativer}
          onVelg={setVariantMerkeId}
          tomtekst={merker.length === 0 ? "Ingen merker — opprett ett i Oppsett" : "Velg merke"}
        />
        <TekstFelt
          label="Verdi per enhet, kr (valgfritt)"
          value={variantVerdi}
          onChangeText={setVariantVerdi}
          placeholder="F.eks. 149,00"
          keyboardType="numeric"
        />
        <View style={stiler.bildeRad}>
          <View style={stiler.bildeRadKnapp}>
            <Knapp
              tittel={variantBildeurl ? "📷 Ta nytt bilde" : "📷 Ta bilde av varen"}
              onPress={taVariantbilde}
              disabled={variantBildeLaster}
              variant="sekundaer"
            />
          </View>
          {variantBildeurl ? <Miniatyr url={variantBildeurl} storrelse={48} /> : null}
        </View>
        <TekstFelt
          label="Bilde-URL (fylles av kamera, kan også limes inn)"
          value={variantBildeurl}
          onChangeText={setVariantBildeurl}
          placeholder="https://..."
        />
        {variantFeil && <FeilBanner tekst={variantFeil} />}
        <Knapp tittel="Legg til variant" onPress={leggTilVariant} disabled={variantLaster} variant="sekundaer" />
      </View>

      <View style={stiler.liste}>
        {varianter.length === 0 ? (
          <TomListeTekst tekst="Ingen varianter registrert ennå." />
        ) : (
          varianter.map((v) => {
            const merke = v.merkeId ? merkeMap.get(v.merkeId) : null;
            return (
              <Pressable key={v.id} onPress={() => setRedigerVariant(v)}>
                <Kort>
                  <View style={stiler.variantRad}>
                    <Miniatyr url={v.bildeurl} bokstav={vareMap.get(v.vareId)?.navn ?? v.sku} />
                    <View style={stiler.variantTekst}>
                      <Text style={stiler.radTittel}>{vareMap.get(v.vareId)?.navn ?? "Ukjent vare"}</Text>
                      <Text style={stiler.radUndertekst}>
                        SKU: {v.sku} · {formatterKroner(v.verdiOre)}
                      </Text>
                    </View>
                    {merke && (
                      <View style={stiler.merkeBadge}>
                        <Text style={stiler.merkeBadgeTekst}>{merke.navn}</Text>
                      </View>
                    )}
                  </View>
                </Kort>
              </Pressable>
            );
          })
        )}
      </View>

      {redigerVariant && (
        <RedigerVariantModal
          variant={redigerVariant}
          vareNavn={vareMap.get(redigerVariant.vareId)?.navn ?? redigerVariant.sku}
          merkeAlternativer={merkeAlternativer}
          onLukk={() => setRedigerVariant(null)}
          onLagret={async () => {
            setRedigerVariant(null);
            await lastInn();
          }}
        />
      )}

      {kameraFormaal && (
        <VareKameraModal
          formaal={kameraFormaal}
          onLukk={() => setKameraFormaal(null)}
          onFunnetEksisterende={(variantId) => {
            setMottakVariantId(variantId);
            setKameraFormaal(null);
          }}
          onForslagNyArtikkel={(resultat, bildeUrl) => {
            setVareNavn(resultat.varetype);
            if (resultat.synligSku) setVariantSku(resultat.synligSku);
            if (bildeUrl) setVariantBildeurl(bildeUrl);
            setKameraFormaal(null);
          }}
        />
      )}
    </ScrollView>
  );
}

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
      setFeil(err instanceof Error ? `Kunne ikke behandle bildet: ${err.message}` : "Kunne ikke behandle bildet.");
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

  // Laster opp det skannede bildet så det blir den nye variantens bilde, og
  // fyller forslaget inn i skjemaet under. Feiler opplastingen, går vi videre
  // uten bilde - det kan legges til manuelt senere.
  async function brukForslag(r: VariantGjenkjenningResultat) {
    setLaster(true);
    try {
      let url: string | undefined;
      if (bilde) {
        try {
          url = (await lastOppBilde(bilde.base64)).url;
        } catch {
          /* ignorer - fortsett uten bilde */
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
            {formaal === "mottak" ? "Ta bilde av varen" : "Ta bilde for forslag til ny artikkel"}
          </Text>
          <Knapp tittel="Åpne kamera" onPress={skannBilde} disabled={laster} variant="sekundaer" />

          {feil && <FeilBanner tekst={feil} />}

          {resultat && !resultat.variantId && resultat.kandidater.length > 1 && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.hjelpetekst}>Flere mulige treff — velg riktig variant:</Text>
              {resultat.kandidater.map((k) => (
                <Pressable key={k.id} style={stiler.kandidatRad} onPress={() => onFunnetEksisterende(k.id)}>
                  <Text style={stiler.radTittel}>{k.navn}</Text>
                  <Text style={stiler.radUndertekst}>{k.sku}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {resultat?.nyVariant && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.hjelpetekst}>
                Ingen treff blant eksisterende varer
                {formaal === "mottak" ? " — rull ned til 'Ny vare' for å opprette den." : "."}
              </Text>
              <Text style={stiler.radTittel}>{resultat.varetype}</Text>
              <Text style={stiler.radUndertekst}>{resultat.beskrivelse}</Text>
              {resultat.synligSku && <Text style={stiler.radUndertekst}>Synlig SKU: {resultat.synligSku}</Text>}
              {formaal === "ny" && (
                <Knapp
                  tittel={bilde ? "Bruk forslag + bilde i skjemaet" : "Bruk forslag i skjemaet under"}
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

function RedigerVariantModal({
  variant,
  vareNavn,
  merkeAlternativer,
  onLukk,
  onLagret,
}: {
  variant: Variant;
  vareNavn: string;
  merkeAlternativer: { verdi: string; label: string; bilde?: string | null }[];
  onLukk: () => void;
  onLagret: () => Promise<void>;
}) {
  const [merkeId, setMerkeId] = useState<string | null>(variant.merkeId);
  const [verdi, setVerdi] = useState(oreTilKrTekst(variant.verdiOre));
  const [bildeurl, setBildeurl] = useState(variant.bildeurl ?? "");
  const [bildeLaster, setBildeLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function byttBilde() {
    setFeil(null);
    setBildeLaster(true);
    try {
      const bilde = await taBilde();
      if (!bilde) return;
      const { url } = await lastOppBilde(bilde.base64);
      setBildeurl(url);
    } catch (err) {
      setFeil(err instanceof Error ? `Bildet feilet: ${err.message}` : "Kunne ikke laste opp bildet. Prøv igjen.");
    } finally {
      setBildeLaster(false);
    }
  }

  async function lagre() {
    setFeil(null);
    const bildeurlTrimmet = bildeurl.trim();
    if (bildeurlTrimmet && !erGyldigUrl(bildeurlTrimmet)) {
      setFeil("Bilde-URL må være en gyldig lenke (https://...).");
      return;
    }
    const verdiOre = verdi.trim() ? krTilOre(verdi) : null;
    if (verdi.trim() && verdiOre === null) {
      setFeil("Verdi må være et gyldig beløp, f.eks. 149,00.");
      return;
    }

    setLaster(true);
    try {
      await oppdaterVariant(variant.id, {
        merkeId: merkeId,
        verdiOre,
        bildeurl: bildeurlTrimmet || null,
      });
      await onLagret();
    } catch (err) {
      setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke lagre endringene.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable style={stiler.modalBakgrunn} onPress={onLukk}>
        <Pressable style={stiler.modalKort} onPress={(e) => e.stopPropagation()}>
          <Text style={stiler.modalTittel}>
            {vareNavn} — {variant.sku}
          </Text>

          <VelgFelt
            label="Merke"
            valgt={merkeId}
            alternativer={merkeAlternativer}
            onVelg={setMerkeId}
            tomtekst="Ingen merke"
          />
          <TekstFelt label="Verdi per enhet, kr" value={verdi} onChangeText={setVerdi} keyboardType="numeric" />
          <View style={stiler.bildeRad}>
            <View style={stiler.bildeRadKnapp}>
              <Knapp
                tittel={bildeurl ? "📷 Ta nytt bilde" : "📷 Ta bilde"}
                onPress={byttBilde}
                disabled={bildeLaster}
                variant="sekundaer"
              />
            </View>
            {bildeurl ? <Miniatyr url={bildeurl} storrelse={48} /> : null}
          </View>
          <TekstFelt label="Bilde-URL" value={bildeurl} onChangeText={setBildeurl} placeholder="https://..." />

          {feil && <FeilBanner tekst={feil} />}

          <View style={stiler.modalKnapper}>
            <View style={stiler.modalKnapp}>
              <Knapp tittel="Avbryt" onPress={onLukk} variant="sekundaer" disabled={laster} />
            </View>
            <View style={stiler.modalKnapp}>
              <Knapp tittel="Lagre" onPress={lagre} disabled={laster} />
            </View>
          </View>
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
    paddingBottom: 32,
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
  suksessTekst: {
    color: farger.primaer,
    fontWeight: "600",
  },
  bildeRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bildeRadKnapp: {
    flex: 1,
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
  variantTekst: {
    flex: 1,
  },
  merkeBadge: {
    backgroundColor: "#eef3f0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  merkeBadgeTekst: {
    fontSize: 12,
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
  modalKnapper: {
    flexDirection: "row",
    gap: 10,
  },
  modalKnapp: {
    flex: 1,
  },
});
