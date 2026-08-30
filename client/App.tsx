import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BeholdningScreen } from "./src/screens/BeholdningScreen";
import { HurtigScreen } from "./src/screens/HurtigScreen";
import { RapporterScreen } from "./src/screens/RapporterScreen";
import { VarerScreen } from "./src/screens/VarerScreen";
import { OppsettScreen } from "./src/screens/OppsettScreen";
import { farger } from "./src/components/ui";
import { hentLagretVerdi, lagreVerdi } from "./src/lib/lagring";

const MODUS_NOKKEL = "artkl_visningsmodus";

// Felt = de som jobber ute med kunder, høyt tempo, få valg.
// Kontor = rapporter/statistikk/referansedata/administrasjon.
// Ingen ekte innlogging ennå - dette er kun en visningsbryter, ikke sikkerhet.
const FELT_FANER = new Set(["beholdning", "hurtig"]);

const FANER = [
  // "hurtig" er den mest brukte funksjonen (ta ut/returner/reserver/svinn/
  // internbruk til kunder) - satt først og er standard landingsskjerm
  // bevisst, for å gjøre den ekstra synlig.
  { nokkel: "hurtig", tittel: "Uttak", ikon: "⚡", Skjerm: HurtigScreen },
  { nokkel: "beholdning", tittel: "Beholdning", ikon: "📦", Skjerm: BeholdningScreen },
  { nokkel: "rapporter", tittel: "Rapporter", ikon: "📊", Skjerm: RapporterScreen },
  // Internt navn "varer" beholdt (kun visningstittelen endret) - dekker
  // både registrering av varemottak og oppretting av nye artikler, derav
  // "Artikkelstyring" fremfor det snevrere "Varer".
  { nokkel: "varer", tittel: "Artikkelstyring", ikon: "🏷️", Skjerm: VarerScreen },
  { nokkel: "oppsett", tittel: "Oppsett", ikon: "⚙️", Skjerm: OppsettScreen },
] as const;

type Modus = "felt" | "kontor";

export default function App() {
  const [modus, setModus] = useState<Modus>("kontor");
  const [aktivFane, setAktivFane] = useState<(typeof FANER)[number]["nokkel"]>("hurtig");

  useEffect(() => {
    const lagret = hentLagretVerdi(MODUS_NOKKEL);
    if (lagret === "felt" || lagret === "kontor") setModus(lagret);
  }, []);

  const synligeFaner = FANER.filter((f) => (modus === "felt" ? FELT_FANER.has(f.nokkel) : true));

  // Bytt vekk fra en fane som forsvinner i felt-modus, så skjermen aldri blir tom.
  useEffect(() => {
    if (!synligeFaner.some((f) => f.nokkel === aktivFane)) {
      setAktivFane(synligeFaner[0]?.nokkel ?? "beholdning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modus]);

  function byttModus() {
    const ny: Modus = modus === "felt" ? "kontor" : "felt";
    setModus(ny);
    lagreVerdi(MODUS_NOKKEL, ny);
  }

  const AktivSkjerm = FANER.find((f) => f.nokkel === aktivFane)?.Skjerm ?? BeholdningScreen;

  return (
    <View style={stiler.rot}>
      <View style={stiler.toppRad}>
        <Pressable style={stiler.modusPille} onPress={byttModus}>
          <Text style={stiler.modusTekst}>{modus === "felt" ? "🚚 Felt-modus" : "🖥️ Kontor-modus"}</Text>
        </Pressable>
      </View>
      <View style={stiler.innhold}>
        <AktivSkjerm />
      </View>
      <View style={stiler.fanebar}>
        {synligeFaner.map((fane) => {
          const erAktiv = fane.nokkel === aktivFane;
          return (
            <Pressable
              key={fane.nokkel}
              style={stiler.fane}
              onPress={() => setAktivFane(fane.nokkel)}
            >
              <Text style={stiler.faneIkon}>{fane.ikon}</Text>
              <Text style={[stiler.faneTekst, erAktiv && stiler.faneTekstAktiv]}>{fane.tittel}</Text>
            </Pressable>
          );
        })}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const stiler = StyleSheet.create({
  rot: {
    flex: 1,
    backgroundColor: "#fff",
    ...(Platform.OS === "web" ? { maxWidth: 480, marginHorizontal: "auto" as never, width: "100%" } : {}),
  },
  toppRad: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  modusPille: {
    backgroundColor: "#f0f0f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modusTekst: {
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
});
