import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiFeil, loggInn, registrer } from "../api";
import { settOkt } from "../lib/auth";
import { farger, FeilBanner, Knapp, TekstFelt } from "../components/ui";

type Modus = "logg-inn" | "registrer";

export function LoggInnScreen() {
  const [modus, setModus] = useState<Modus>("logg-inn");
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [navn, setNavn] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function send() {
    setFeil(null);
    if (!epost.trim() || !passord) {
      setFeil("Fyll ut e-post og passord.");
      return;
    }
    if (modus === "registrer" && !navn.trim()) {
      setFeil("Fyll ut navn.");
      return;
    }
    if (modus === "registrer" && passord.length < 8) {
      setFeil("Passordet må ha minst 8 tegn.");
      return;
    }

    setLaster(true);
    try {
      const svar =
        modus === "logg-inn"
          ? await loggInn(epost.trim(), passord)
          : await registrer(epost.trim(), passord, navn.trim());
      settOkt(svar.token, svar.bruker, svar.bedrifter);
    } catch (err) {
      setFeil(
        err instanceof ApiFeil
          ? err.message
          : "Kunne ikke koble til serveren. Sjekk at backend kjører.",
      );
    } finally {
      setLaster(false);
    }
  }

  return (
    <View style={stiler.rot}>
      <View style={stiler.kort}>
        <Text style={stiler.tittel}>SWAGR</Text>
        <Text style={stiler.undertekst}>
          {modus === "logg-inn" ? "Logg inn for å fortsette" : "Opprett konto (krever invitasjon)"}
        </Text>

        <TekstFelt
          label="E-post"
          value={epost}
          onChangeText={setEpost}
          placeholder="deg@firma.no"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        {modus === "registrer" && (
          <TekstFelt label="Navn" value={navn} onChangeText={setNavn} placeholder="Fornavn Etternavn" autoComplete="name" />
        )}
        <TekstFelt
          label="Passord"
          value={passord}
          onChangeText={setPassord}
          placeholder={modus === "registrer" ? "Minst 8 tegn" : ""}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />

        {feil && <FeilBanner tekst={feil} />}

        <Knapp
          tittel={modus === "logg-inn" ? "Logg inn" : "Registrer"}
          onPress={send}
          disabled={laster}
        />

        <Pressable
          style={stiler.bytt}
          onPress={() => {
            setModus(modus === "logg-inn" ? "registrer" : "logg-inn");
            setFeil(null);
          }}
        >
          <Text style={stiler.byttTekst}>
            {modus === "logg-inn"
              ? "Har du en invitasjon? Opprett konto"
              : "Har du allerede konto? Logg inn"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const stiler = StyleSheet.create({
  rot: {
    flex: 1,
    backgroundColor: "#f4f6f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  kort: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 14,
    width: "100%",
    maxWidth: 380,
    ...(Platform.OS === "web" ? { boxShadow: "0 1px 12px rgba(0,0,0,0.08)" as never } : {}),
  },
  tittel: {
    fontSize: 28,
    fontWeight: "800",
    color: farger.primaer,
    textAlign: "center",
  },
  undertekst: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 4,
  },
  bytt: {
    alignItems: "center",
    paddingVertical: 6,
  },
  byttTekst: {
    fontSize: 13,
    color: farger.primaer,
    fontWeight: "600",
  },
});
