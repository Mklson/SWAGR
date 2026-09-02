import { useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BeholdningScreen } from "./src/screens/BeholdningScreen";
import { HurtigScreen } from "./src/screens/HurtigScreen";
import { RapporterScreen } from "./src/screens/RapporterScreen";
import { VarerScreen } from "./src/screens/VarerScreen";
import { OppsettScreen } from "./src/screens/OppsettScreen";
import { LoggInnScreen } from "./src/screens/LoggInnScreen";
import { farger } from "./src/components/ui";
import {
  abonner,
  erInnlogget,
  hentAktivBedrift,
  hentBedriftId,
  hentBedrifter,
  hentLagretBruker,
  loggUt,
  settAktivBedrift,
} from "./src/lib/auth";

const FANER = [
  { nokkel: "hurtig", tittel: "Uttak", ikon: "⚡", Skjerm: HurtigScreen },
  { nokkel: "beholdning", tittel: "Beholdning", ikon: "📦", Skjerm: BeholdningScreen },
  { nokkel: "rapporter", tittel: "Rapporter", ikon: "📊", Skjerm: RapporterScreen },
  { nokkel: "varer", tittel: "Artikkelstyring", ikon: "🏷️", Skjerm: VarerScreen },
  { nokkel: "oppsett", tittel: "Oppsett", ikon: "⚙️", Skjerm: OppsettScreen },
] as const;

export default function App() {
  const [innlogget, setInnlogget] = useState(erInnlogget());
  const [bedriftId, setBedriftId] = useState(hentBedriftId());

  useEffect(
    () =>
      abonner(() => {
        setInnlogget(erInnlogget());
        setBedriftId(hentBedriftId());
      }),
    [],
  );

  return (
    <View style={stiler.rot}>
      {innlogget ? <AutentisertApp key={bedriftId ?? "ingen"} /> : <LoggInnScreen />}
      <StatusBar style="auto" />
    </View>
  );
}

function AutentisertApp() {
  const [aktivFane, setAktivFane] = useState<(typeof FANER)[number]["nokkel"]>("hurtig");
  const [velgerÅpen, setVelgerÅpen] = useState(false);
  const bruker = hentLagretBruker();
  const bedrifter = hentBedrifter();
  const aktivBedrift = hentAktivBedrift();

  const AktivSkjerm = FANER.find((f) => f.nokkel === aktivFane)?.Skjerm ?? BeholdningScreen;
  const flereBedrifter = bedrifter.length > 1;

  return (
    <>
      {aktivBedrift?.logoUrl ? (
        <View style={stiler.logoBar}>
          <Image source={{ uri: aktivBedrift.logoUrl }} style={stiler.logo} resizeMode="contain" />
        </View>
      ) : null}

      {aktivBedrift && (
        <Pressable
          style={stiler.bedriftBar}
          onPress={() => flereBedrifter && setVelgerÅpen(true)}
          disabled={!flereBedrifter}
        >
          <Text style={stiler.bedriftBarTekst}>
            🏢 {aktivBedrift.navn}
            {flereBedrifter ? "  ▾" : ""}
          </Text>
        </Pressable>
      )}

      <View style={stiler.toppRad}>
        <Pressable style={stiler.loggUtPille} onPress={loggUt}>
          <Text style={stiler.loggUtTekst}>{bruker?.navn ? `${bruker.navn} · Logg ut` : "Logg ut"}</Text>
        </Pressable>
      </View>

      <View style={stiler.innhold}>
        <AktivSkjerm />
      </View>

      <View style={stiler.fanebar}>
        {FANER.map((fane) => {
          const erAktiv = fane.nokkel === aktivFane;
          return (
            <Pressable key={fane.nokkel} style={stiler.fane} onPress={() => setAktivFane(fane.nokkel)}>
              <Text style={stiler.faneIkon}>{fane.ikon}</Text>
              <Text style={[stiler.faneTekst, erAktiv && stiler.faneTekstAktiv]}>{fane.tittel}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={velgerÅpen} transparent animationType="fade" onRequestClose={() => setVelgerÅpen(false)}>
        <Pressable style={stiler.modalBakgrunn} onPress={() => setVelgerÅpen(false)}>
          <View style={stiler.modalKort}>
            <Text style={stiler.modalTittel}>Bytt bedrift</Text>
            {bedrifter.map((b) => (
              <Pressable
                key={b.id}
                style={stiler.bedriftRad}
                onPress={() => {
                  setVelgerÅpen(false);
                  settAktivBedrift(b.id);
                }}
              >
                <Text style={[stiler.bedriftRadTekst, b.id === aktivBedrift?.id && stiler.bedriftRadAktiv]}>
                  {b.navn}
                </Text>
                <Text style={stiler.bedriftRadRolle}>{b.rolle}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const stiler = StyleSheet.create({
  rot: {
    flex: 1,
    backgroundColor: "#fff",
    // Bredere ramme på web slik at appen er brukbar på PC, ikke bare mobil.
    ...(Platform.OS === "web"
      ? { maxWidth: 960, marginHorizontal: "auto" as never, width: "100%" }
      : {}),
  },
  logoBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  logo: {
    height: 56,
    width: "90%",
    maxWidth: 460,
  },
  bedriftBar: {
    backgroundColor: farger.primaer,
    paddingVertical: 6,
    alignItems: "center",
  },
  bedriftBarTekst: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  toppRad: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  loggUtPille: {
    backgroundColor: "#f0f0f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loggUtTekst: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  innhold: {
    flex: 1,
  },
  fanebar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingTop: 8,
    backgroundColor: "#fff",
  },
  fane: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  faneIkon: {
    fontSize: 18,
  },
  faneTekst: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
  },
  faneTekstAktiv: {
    color: farger.primaer,
  },
  modalBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 32,
  },
  modalKort: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  modalTittel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bedriftRad: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  bedriftRadTekst: {
    fontSize: 15,
    color: farger.tekst,
  },
  bedriftRadAktiv: {
    fontWeight: "700",
    color: farger.primaer,
  },
  bedriftRadRolle: {
    fontSize: 12,
    color: "#999",
  },
});
