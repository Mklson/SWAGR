import { View, StyleSheet } from "react-native";
import { Knapp } from "./ui";
import { taBilde, velgBildeFraBibliotek, type KomprimertBilde } from "../lib/bilde";

/**
 * To knapper: ta bilde med kamera, eller velg fra enhetens bildebibliotek.
 * Kaller onValgt med et ferdig komprimert bilde. Plukke-/komprimeringsfeil
 * går til onFeil (opplasting håndteres av forelderen i onValgt).
 */
export function BildeVelger({
  laster,
  onValgt,
  onFeil,
}: {
  laster: boolean;
  onValgt: (bilde: KomprimertBilde) => void | Promise<void>;
  onFeil?: (melding: string) => void;
}) {
  async function kjor(hent: () => Promise<KomprimertBilde | null>) {
    try {
      const bilde = await hent();
      if (bilde) await onValgt(bilde);
    } catch (err) {
      onFeil?.(err instanceof Error ? err.message : "Kunne ikke hente bildet.");
    }
  }

  return (
    <View style={stiler.rad}>
      <View style={stiler.knapp}>
        <Knapp tittel="📷 Ta bilde" onPress={() => kjor(taBilde)} disabled={laster} variant="sekundaer" />
      </View>
      <View style={stiler.knapp}>
        <Knapp
          tittel="🖼 Bibliotek"
          onPress={() => kjor(velgBildeFraBibliotek)}
          disabled={laster}
          variant="sekundaer"
        />
      </View>
    </View>
  );
}

const stiler = StyleSheet.create({
  rad: { flexDirection: "row", gap: 8 },
  knapp: { flex: 1 },
});
