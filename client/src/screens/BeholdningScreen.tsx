import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiFeil,
  gjenkjennVariant,
  hentBeholdning,
  listLokasjoner,
  listMerker,
  listVarer,
  listVarianter,
} from "../api";
import { taBilde, type KomprimertBilde } from "../lib/bilde";
import { KATEGORIER } from "../lib/kategorier";
import { ALLE_KATEGORIER, MerkeOgKategoriFilter, UTEN_MERKE } from "../components/VareFilter";
import type { BeholdningRad, Lokasjon, Merke, Vare, Variant, VariantGjenkjenningResultat } from "../types";
import { farger, FeilBanner, Knapp, Kort, Miniatyr, TomListeTekst } from "../components/ui";

interface BeholdningVisningsrad extends BeholdningRad {
  variantNavn: string;
  søketekst: string;
  lokasjonNavn: string;
  bildeurl: string | null;
  merkeId: string | null;
  merkeNavn: string | null;
  kategori: string | null;
}

export function BeholdningScreen() {
  const [rader, setRader] = useState<BeholdningVisningsrad[]>([]);
  const [merker, setMerker] = useState<Merke[]>([]);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  const [valgtMerke, setValgtMerke] = useState<string | null>(null);
  const [valgtKategori, setValgtKategori] = useState<string>(ALLE_KATEGORIER);
  const [søk, setSøk] = useState("");
  const [kameraÅpen, setKameraÅpen] = useState(false);

  const lastInn = useCallback(async () => {
    setFeil(null);
    try {
      const [beholdning, varianter, varer, lokasjoner, merkerListe] = await Promise.all([
        hentBeholdning(),
        listVarianter(),
        listVarer(),
        listLokasjoner(),
        listMerker(),
      ]);
      const vareMap = new Map<string, Vare>(varer.map((v) => [v.id, v]));
      const variantMap = new Map<string, Variant>(varianter.map((v) => [v.id, v]));
      const lokasjonMap = new Map<string, Lokasjon>(lokasjoner.map((l) => [l.id, l]));
      const merkeMap = new Map<string, Merke>(merkerListe.map((m) => [m.id, m]));

      const visningsrader: BeholdningVisningsrad[] = beholdning
        .map((rad) => {
          const variant = variantMap.get(rad.variantId);
          const vare = variant ? vareMap.get(variant.vareId) : undefined;
          const lokasjon = lokasjonMap.get(rad.lokasjonId);
          const merke = variant?.merkeId ? merkeMap.get(variant.merkeId) : undefined;
          const variantNavn = variant ? `${vare?.navn ?? "Ukjent vare"} — ${variant.sku}` : "Ukjent variant";
          return {
            ...rad,
            variantNavn,
            søketekst: `${variantNavn} ${merke?.navn ?? ""}`.toLowerCase(),
            lokasjonNavn: lokasjon?.navn ?? "Ukjent lokasjon",
            bildeurl: variant?.bildeurl ?? null,
            merkeId: variant?.merkeId ?? null,
            merkeNavn: merke?.navn ?? null,
            kategori: vare?.kategori ?? null,
          };
        })
        .sort((a, b) => a.variantNavn.localeCompare(b.variantNavn));

      setRader(visningsrader);
      setMerker(merkerListe);
    } catch {
      setFeil("Kunne ikke hente beholdning. Sjekk at backend kjører.");
    } finally {
      setLaster(false);
    }
  }, []);

  useEffect(() => {
    lastInn();
  }, [lastInn]);

  const merkeAlternativer = useMemo(() => {
    const idSet = new Set(rader.map((r) => r.merkeId).filter((id): id is string => id !== null));
    return merker
      .filter((m) => idSet.has(m.id))
      .map((m) => ({ id: m.id, navn: m.navn, logoUrl: m.logoUrl }));
  }, [rader, merker]);
  const harUtenMerke = useMemo(() => rader.some((r) => !r.merkeId), [rader]);
  const kategoriAlternativer = useMemo(() => {
    const iData = new Set<string>();
    for (const r of rader) if (r.kategori) iData.add(r.kategori);
    const ekstra = [...iData].filter((k) => !KATEGORIER.includes(k as never)).sort();
    return [...KATEGORIER, ...ekstra];
  }, [rader]);

  const filtrerteRader = useMemo(() => {
    let resultat = rader;
    if (valgtMerke === UTEN_MERKE) resultat = resultat.filter((r) => !r.merkeId);
    else if (valgtMerke !== null) resultat = resultat.filter((r) => r.merkeId === valgtMerke);

    if (valgtKategori !== ALLE_KATEGORIER) resultat = resultat.filter((r) => r.kategori === valgtKategori);

    const søkLav = søk.trim().toLowerCase();
    if (søkLav) resultat = resultat.filter((r) => r.søketekst.includes(søkLav));
    return resultat;
  }, [rader, valgtMerke, valgtKategori, søk]);

  const seksjoner = useMemo(() => {
    const grupper = new Map<string, BeholdningVisningsrad[]>();
    for (const rad of filtrerteRader) {
      const nokkel = rad.merkeId ?? UTEN_MERKE;
      const liste = grupper.get(nokkel) ?? [];
      liste.push(rad);
      grupper.set(nokkel, liste);
    }
    return Array.from(grupper.entries())
      .sort(([a], [b]) => {
        if (a === UTEN_MERKE) return 1;
        if (b === UTEN_MERKE) return -1;
        return (grupper.get(a)?.[0].merkeNavn ?? "").localeCompare(grupper.get(b)?.[0].merkeNavn ?? "");
      })
      .map(([nokkel, data]) => ({
        title: nokkel === UTEN_MERKE ? "Uten merke" : data[0].merkeNavn ?? "Ukjent merke",
        data,
      }));
  }, [filtrerteRader]);

  return (
    <View style={stiler.rot}>
      <View style={stiler.header}>
        <Text style={stiler.tittel}>Beholdning</Text>
        <Text style={stiler.undertekst}>Nåværende antall per variant og lokasjon</Text>
      </View>

      <MerkeOgKategoriFilter
        idPrefiks="beholdning"
        merkeAlternativer={merkeAlternativer}
        harUtenMerke={harUtenMerke}
        valgtMerke={valgtMerke}
        onValgtMerkeChange={setValgtMerke}
        kategoriAlternativer={kategoriAlternativer}
        valgtKategori={valgtKategori}
        onValgtKategoriChange={setValgtKategori}
      />

      <View style={stiler.søkRad}>
        <TextInput
          style={stiler.søkInput}
          value={søk}
          onChangeText={setSøk}
          placeholder="Søk artikkel, SKU eller merke..."
        />
        <Pressable style={stiler.kameraKnapp} onPress={() => setKameraÅpen(true)}>
          <Text style={stiler.kameraKnappTekst}>📷 Ta bilde av en artikkel for å finne den</Text>
        </Pressable>
      </View>

      {feil && <FeilBanner tekst={feil} />}

      <SectionList
        sections={seksjoner}
        keyExtractor={(item) => `${item.variantId}:${item.lokasjonId}`}
        contentContainerStyle={stiler.liste}
        refreshControl={<RefreshControl refreshing={laster} onRefresh={lastInn} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          !laster && !feil ? (
            <TomListeTekst
              tekst={søk.trim() ? "Ingen treff på søket." : "Ingen bevegelser registrert ennå."}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => <Text style={stiler.seksjonTittel}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Kort>
            <View style={stiler.radInnhold}>
              <Miniatyr url={item.bildeurl} bokstav={item.variantNavn} />
              <View style={stiler.radTekst}>
                <Text style={stiler.radTittel}>{item.variantNavn}</Text>
                <Text style={stiler.radLokasjon}>{item.lokasjonNavn}</Text>
                {item.reservert > 0 && (
                  <Text style={stiler.radReservert}>{item.reservert} stk reservert</Text>
                )}
              </View>
              <View style={stiler.radTall}>
                <Text style={[stiler.radBeholdning, item.beholdning < 0 && stiler.radBeholdningNegativ]}>
                  {item.beholdning} stk
                </Text>
                {item.reservert > 0 && (
                  <Text style={stiler.radTilgjengelig}>{item.tilgjengelig} tilgjengelig</Text>
                )}
              </View>
            </View>
          </Kort>
        )}
      />

      {kameraÅpen && (
        <BeholdningKameraModal
          onLukk={() => setKameraÅpen(false)}
          onFunnet={(sku) => {
            setSøk(sku);
            setValgtMerke(null);
            setValgtKategori(ALLE_KATEGORIER);
            setKameraÅpen(false);
          }}
        />
      )}
    </View>
  );
}

function BeholdningKameraModal({
  onLukk,
  onFunnet,
}: {
  onLukk: () => void;
  onFunnet: (sku: string) => void;
}) {
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<VariantGjenkjenningResultat | null>(null);

  async function skann() {
    setFeil(null);
    setResultat(null);
    let bilde: KomprimertBilde | null;
    try {
      bilde = await taBilde();
    } catch (err) {
      setFeil(err instanceof Error ? `Kunne ikke behandle bildet: ${err.message}` : "Kunne ikke behandle bildet.");
      return;
    }
    if (!bilde) return;

    setLaster(true);
    try {
      const svar = await gjenkjennVariant(bilde.base64, "image/jpeg");
      const treff = svar.kandidater;
      if (treff.length === 1) {
        onFunnet(treff[0].sku);
        return;
      }
      setResultat(svar);
    } catch (err) {
      if (err instanceof ApiFeil && err.status === 503) {
        setFeil("Bildegjenkjenning er ikke konfigurert på serveren ennå.");
      } else {
        setFeil(err instanceof ApiFeil ? err.message : "Kunne ikke koble til serveren.");
      }
    } finally {
      setLaster(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLukk}>
      <Pressable style={stiler.modalBakgrunn} onPress={onLukk}>
        <Pressable style={stiler.modalKort} onPress={(e) => e.stopPropagation()}>
          <Text style={stiler.modalTittel}>Finn artikkel via bilde</Text>
          <Knapp tittel="Åpne kamera" onPress={skann} disabled={laster} variant="sekundaer" />

          {feil && <FeilBanner tekst={feil} />}

          {resultat && resultat.kandidater.length > 1 && (
            <View style={stiler.kandidatListe}>
              <Text style={stiler.radLokasjon}>Flere mulige treff — velg riktig:</Text>
              {resultat.kandidater.map((k) => (
                <Pressable key={k.id} style={stiler.kandidatRad} onPress={() => onFunnet(k.sku)}>
                  <Text style={stiler.radTittel}>{k.navn}</Text>
                  <Text style={stiler.radLokasjon}>{k.sku}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {resultat && resultat.kandidater.length === 0 && (
            <Text style={stiler.radLokasjon}>
              Ingen artikkel i beholdningen matcher bildet ({resultat.varetype}).
            </Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 4,
  },
  tittel: {
    fontSize: 24,
    fontWeight: "700",
  },
  undertekst: {
    fontSize: 14,
    color: farger.undertekst,
  },
  søkRad: {
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
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
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#eef3f0",
    borderRadius: 8,
  },
  kameraKnappTekst: {
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
  liste: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  seksjonTittel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
  },
  radInnhold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  radTekst: {
    flex: 1,
  },
  radTittel: {
    fontSize: 15,
    fontWeight: "600",
    color: farger.tekst,
  },
  radLokasjon: {
    fontSize: 13,
    color: "#888",
  },
  radReservert: {
    fontSize: 12,
    color: farger.advarselKant,
    fontWeight: "600",
    marginTop: 2,
  },
  radTall: {
    alignItems: "flex-end",
  },
  radBeholdning: {
    fontSize: 16,
    fontWeight: "700",
    color: farger.primaer,
  },
  radBeholdningNegativ: {
    color: farger.feilTekst,
  },
  radTilgjengelig: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
});
