import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { farger } from "./ui";
import { skjulScrollbarForId } from "../lib/skjulScrollbar";

export const UTEN_MERKE = "__uten_merke__";
export const ALLE_KATEGORIER = "__alle_kategorier__";

export interface MerkeAlternativ {
  id: string;
  navn: string;
  logoUrl: string | null;
}

/** Delt av Beholdning og Hurtig, slik at merke/kategori-filtrering ser og
 * oppfører seg likt begge steder. ScrollView-høyden er satt eksplisitt (ikke
 * overlatt til intrinsic sizing) - uten det kollapser react-native-web disse
 * til høyde 0 på første tegning inntil en hvilken som helst interaksjon
 * tvinger frem et nytt layout-pass (viste seg som "logoene er sammenfoldet
 * til man klikker" / usynlig kategori-tekst). */
export function MerkeOgKategoriFilter({
  idPrefiks,
  merkeAlternativer,
  harUtenMerke,
  valgtMerke,
  onValgtMerkeChange,
  kategoriAlternativer,
  valgtKategori,
  onValgtKategoriChange,
}: {
  idPrefiks: string;
  merkeAlternativer: MerkeAlternativ[];
  harUtenMerke: boolean;
  valgtMerke: string | null;
  onValgtMerkeChange: (id: string | null) => void;
  kategoriAlternativer: string[];
  valgtKategori: string;
  onValgtKategoriChange: (kategori: string) => void;
}) {
  skjulScrollbarForId(`${idPrefiks}-merke-hylle`);
  skjulScrollbarForId(`${idPrefiks}-kategori-rad`);

  return (
    <>
      {(merkeAlternativer.length > 0 || harUtenMerke) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nativeID={`${idPrefiks}-merke-hylle`}
          style={stiler.merkeHylle}
          contentContainerStyle={stiler.merkeHylleInnhold}
        >
          <MerkeChip navn="Alle" aktiv={valgtMerke === null} onPress={() => onValgtMerkeChange(null)} />
          {merkeAlternativer.map((m) => (
            <MerkeChip
              key={m.id}
              navn={m.navn}
              logoUrl={m.logoUrl}
              aktiv={valgtMerke === m.id}
              onPress={() => onValgtMerkeChange(m.id)}
            />
          ))}
          {harUtenMerke && (
            <MerkeChip
              navn="Uten merke"
              aktiv={valgtMerke === UTEN_MERKE}
              onPress={() => onValgtMerkeChange(UTEN_MERKE)}
            />
          )}
        </ScrollView>
      )}

      {kategoriAlternativer.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nativeID={`${idPrefiks}-kategori-rad`}
          style={stiler.kategoriRad}
          contentContainerStyle={stiler.kategoriRadInnhold}
        >
          <KategoriChip
            navn="Alle kategorier"
            aktiv={valgtKategori === ALLE_KATEGORIER}
            onPress={() => onValgtKategoriChange(ALLE_KATEGORIER)}
          />
          {kategoriAlternativer.map((k) => (
            <KategoriChip
              key={k}
              navn={k}
              aktiv={valgtKategori === k}
              onPress={() => onValgtKategoriChange(k)}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function MerkeChip({
  navn,
  logoUrl,
  aktiv,
  onPress,
}: {
  navn: string;
  logoUrl?: string | null;
  aktiv: boolean;
  onPress: () => void;
}) {
  // Trunkerer i JS i stedet for numberOfLines - react-native-web sin
  // numberOfLines-polyfill kolliderer med flex-krysningsaksen og gir høyde 0
  // (teksten finnes i DOM men er usynlig), en kjent RNW-kvirk.
  const visningsnavn = navn.length > 11 ? `${navn.slice(0, 10)}…` : navn;
  return (
    <Pressable style={stiler.merkeChip} onPress={onPress}>
      <View style={[stiler.merkeChipFlate, aktiv && stiler.merkeChipFlateAktiv]}>
        <MerkeLogo logoUrl={logoUrl} navn={navn} />
      </View>
      <Text style={[stiler.merkeChipTekst, aktiv && stiler.merkeChipTekstAktiv]}>{visningsnavn}</Text>
    </Pressable>
  );
}

/** Merkelogo i en bred, rektangulær flate med «contain» - horisontale logoer
 * vises i sin helhet i stedet for å bli midtstilt-beskåret i en liten firkant.
 * Faller tilbake til forbokstaven når det ikke finnes logo eller den feiler. */
function MerkeLogo({ logoUrl, navn }: { logoUrl?: string | null; navn: string }) {
  const [feilet, setFeilet] = useState(false);
  if (logoUrl && !feilet) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={stiler.merkeLogoBilde}
        resizeMode="contain"
        onError={() => setFeilet(true)}
      />
    );
  }
  return <Text style={stiler.merkeLogoBokstav}>{navn.charAt(0).toUpperCase()}</Text>;
}

function KategoriChip({ navn, aktiv, onPress }: { navn: string; aktiv: boolean; onPress: () => void }) {
  return (
    <Pressable style={[stiler.kategoriChip, aktiv && stiler.kategoriChipAktiv]} onPress={onPress}>
      <Text style={[stiler.kategoriChipTekst, aktiv && stiler.kategoriChipTekstAktiv]}>{navn}</Text>
    </Pressable>
  );
}

const stiler = StyleSheet.create({
  merkeHylle: {
    flexGrow: 0,
    flexShrink: 0,
    height: 84,
    marginBottom: 10,
  },
  merkeHylleInnhold: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  merkeChip: {
    alignItems: "center",
    width: 92,
    gap: 4,
  },
  merkeChipFlate: {
    width: 92,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#eee",
    overflow: "hidden",
  },
  merkeChipFlateAktiv: {
    borderColor: farger.primaer,
  },
  merkeLogoBilde: {
    width: "100%",
    height: "100%",
  },
  merkeLogoBokstav: {
    fontSize: 20,
    fontWeight: "700",
    color: farger.primaer,
  },
  merkeChipTekst: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  merkeChipTekstAktiv: {
    color: farger.primaer,
    fontWeight: "700",
  },
  kategoriRad: {
    flexGrow: 0,
    flexShrink: 0,
    height: 36,
    marginBottom: 14,
  },
  kategoriRadInnhold: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  kategoriChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f0f0f0",
  },
  kategoriChipAktiv: {
    backgroundColor: farger.primaer,
  },
  kategoriChipTekst: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  kategoriChipTekstAktiv: {
    color: "#fff",
  },
});
