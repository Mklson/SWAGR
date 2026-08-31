import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

export const farger = {
  primaer: "#1a6f3d",
  mork: "#333",
  tekst: "#222",
  undertekst: "#555",
  kant: "#ddd",
  bakgrunn: "#fff",
  feilBg: "#fde8e8",
  feilTekst: "#a11",
  advarselBg: "#fdf3e3",
  advarselKant: "#c98a1a",
};

export function Knapp({
  tittel,
  onPress,
  variant = "primaer",
  disabled,
}: {
  tittel: string;
  onPress: () => void;
  variant?: "primaer" | "sekundaer";
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        stiler.knapp,
        variant === "primaer" ? stiler.knappPrimaer : stiler.knappSekundaer,
        disabled && stiler.knappDeaktivert,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {disabled ? (
        <ActivityIndicator color={variant === "primaer" ? "#fff" : farger.mork} />
      ) : (
        <Text
          style={variant === "primaer" ? stiler.knappTekst : stiler.knappTekstSekundaer}
        >
          {tittel}
        </Text>
      )}
    </Pressable>
  );
}

export function TekstFelt({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "name" | "off";
}) {
  return (
    <View style={stiler.felt}>
      <Text style={stiler.feltLabel}>{label}</Text>
      <TextInput
        style={stiler.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
      />
    </View>
  );
}

export function Miniatyr({ url, bokstav, storrelse = 40 }: { url?: string | null; bokstav?: string; storrelse?: number }) {
  const [feilet, setFeilet] = useState(false);
  const style = { width: storrelse, height: storrelse, borderRadius: storrelse / 4 };
  if (url && !feilet) {
    return <Image source={{ uri: url }} style={[stiler.miniatyrBilde, style]} onError={() => setFeilet(true)} />;
  }
  return (
    <View style={[stiler.miniatyrPlassholder, style]}>
      <Text style={[stiler.miniatyrBokstav, { fontSize: storrelse * 0.4 }]}>
        {(bokstav ?? "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export interface ValgAlternativ {
  verdi: string;
  label: string;
  undertekst?: string;
  bilde?: string | null;
}

export function VelgFelt({
  label,
  valgt,
  alternativer,
  onVelg,
  tomtekst = "Ingen valgt",
}: {
  label: string;
  valgt: string | null;
  alternativer: ValgAlternativ[];
  onVelg: (verdi: string) => void;
  tomtekst?: string;
}) {
  const [apen, setApen] = useState(false);
  const [anker, setAnker] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const knappRef = useRef<View>(null);
  const { height: skjermHoyde } = useWindowDimensions();
  const valgtAlternativ = alternativer.find((a) => a.verdi === valgt);

  function apne() {
    // Mål feltet så nedtrekket kan legges rett under med nøyaktig samme bredde.
    knappRef.current?.measureInWindow((x, y, width, height) => {
      setAnker({ x, y, width, height });
      setApen(true);
    });
  }

  // Legg lista under feltet, eller over hvis det er klart mer plass der.
  const plassUnder = anker ? skjermHoyde - (anker.y + anker.height) - 12 : 0;
  const plassOver = anker ? anker.y - 12 : 0;
  const visOver = plassOver > plassUnder && plassOver > 220;
  const maksHoyde = Math.max(140, Math.min(340, visOver ? plassOver : plassUnder));

  return (
    <View style={stiler.felt}>
      <Text style={stiler.feltLabel}>{label}</Text>
      <Pressable ref={knappRef} style={stiler.valgKnapp} onPress={apne}>
        <Text style={valgtAlternativ ? stiler.valgTekst : stiler.valgTekstTom}>
          {valgtAlternativ ? valgtAlternativ.label : tomtekst}
        </Text>
      </Pressable>
      <Modal visible={apen} transparent animationType="fade" onRequestClose={() => setApen(false)}>
        <Pressable style={stiler.nedtrekkBakgrunn} onPress={() => setApen(false)}>
          {anker && (
            <View
              style={[
                stiler.nedtrekkListe,
                {
                  left: anker.x,
                  width: anker.width,
                  maxHeight: maksHoyde,
                  ...(visOver
                    ? { bottom: skjermHoyde - anker.y + 4 }
                    : { top: anker.y + anker.height + 4 }),
                },
              ]}
            >
              {alternativer.length === 0 ? (
                <Text style={stiler.nedtrekkTomtekst}>Ingen alternativer ennå</Text>
              ) : (
                <FlatList
                  data={alternativer}
                  keyExtractor={(item) => item.verdi}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={[stiler.modalRad, stiler.modalRadMedBilde]}
                      onPress={() => {
                        onVelg(item.verdi);
                        setApen(false);
                      }}
                    >
                      {item.bilde !== undefined && (
                        <Miniatyr url={item.bilde} bokstav={item.label} storrelse={32} />
                      )}
                      <View style={stiler.modalRadTekst}>
                        <Text style={stiler.modalRadTittel}>{item.label}</Text>
                        {item.undertekst && (
                          <Text style={stiler.modalRadUndertekst}>{item.undertekst}</Text>
                        )}
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

export function AntallVelger({
  verdi,
  onChange,
  tilgjengelig,
}: {
  verdi: number;
  onChange: (v: number) => void;
  tilgjengelig?: number;
}) {
  function juster(delta: number) {
    onChange(Math.max(1, verdi + delta));
  }
  return (
    <View style={stiler.felt}>
      <Text style={stiler.feltLabel}>Antall</Text>
      <View style={stiler.antallRad}>
        <Pressable style={stiler.antallKnapp} onPress={() => juster(-1)}>
          <Text style={stiler.antallKnappTekst}>−</Text>
        </Pressable>
        <TextInput
          style={stiler.antallInput}
          value={String(verdi)}
          onChangeText={(t) => onChange(Math.max(0, Number.parseInt(t, 10) || 0))}
          keyboardType="numeric"
        />
        <Pressable style={stiler.antallKnapp} onPress={() => juster(1)}>
          <Text style={stiler.antallKnappTekst}>+</Text>
        </Pressable>
      </View>
      <View style={stiler.antallHurtigRad}>
        {[5, 10, 25].map((n) => (
          <Pressable key={n} style={stiler.antallHurtigKnapp} onPress={() => juster(n)}>
            <Text style={stiler.antallHurtigTekst}>+{n}</Text>
          </Pressable>
        ))}
      </View>
      {tilgjengelig !== undefined && (
        <Text style={verdi > tilgjengelig ? stiler.antallAdvarsel : stiler.antallTilgjengelig}>
          {tilgjengelig} tilgjengelig
        </Text>
      )}
    </View>
  );
}

export function Kort({ children }: { children: React.ReactNode }) {
  return <View style={stiler.kort}>{children}</View>;
}

export function SeksjonsTittel({ children }: { children: React.ReactNode }) {
  return <Text style={stiler.seksjonsTittel}>{children}</Text>;
}

/**
 * Sammenleggbar seksjon. Kontrollert av forelderen (apen/onToggle) så en
 * skjerm kan la bare én stå åpen om gangen (trekkspill).
 */
export function Sammenleggbar({
  tittel,
  undertekst,
  apen,
  onToggle,
  children,
}: {
  tittel: string;
  undertekst?: string;
  apen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={stiler.sammenleggbar}>
      <Pressable style={stiler.sammenleggbarHode} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={stiler.sammenleggbarTittel}>{tittel}</Text>
          {undertekst ? <Text style={stiler.sammenleggbarUndertekst}>{undertekst}</Text> : null}
        </View>
        <Text style={stiler.sammenleggbarPil}>{apen ? "▾" : "▸"}</Text>
      </Pressable>
      {apen ? <View style={stiler.sammenleggbarInnhold}>{children}</View> : null}
    </View>
  );
}

export function FeilBanner({ tekst }: { tekst: string }) {
  return (
    <View style={stiler.feilBoks}>
      <Text style={stiler.feilBoksTekst}>{tekst}</Text>
    </View>
  );
}

export function TomListeTekst({ tekst }: { tekst: string }) {
  return <Text style={stiler.tomListeTekst}>{tekst}</Text>;
}

const stiler = StyleSheet.create({
  knapp: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  knappPrimaer: {
    backgroundColor: farger.primaer,
  },
  knappSekundaer: {
    backgroundColor: "#eee",
  },
  knappDeaktivert: {
    opacity: 0.6,
  },
  knappTekst: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  knappTekstSekundaer: {
    color: farger.mork,
    fontSize: 16,
    fontWeight: "600",
  },
  felt: {
    gap: 6,
  },
  feltLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.undertekst,
  },
  input: {
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: farger.tekst,
  },
  valgKnapp: {
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  valgTekst: {
    fontSize: 15,
    color: farger.tekst,
  },
  valgTekstTom: {
    fontSize: 15,
    color: "#999",
  },
  modalBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalInnhold: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    maxHeight: "70%",
  },
  nedtrekkBakgrunn: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  nedtrekkListe: {
    position: "absolute",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 8px 24px rgba(0,0,0,0.16)" as never }
      : { elevation: 8 }),
  },
  nedtrekkTomtekst: {
    color: "#888",
    paddingVertical: 12,
  },
  sammenleggbar: {
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 10,
    overflow: "hidden",
  },
  sammenleggbarHode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#fafafa",
  },
  sammenleggbarTittel: {
    fontSize: 15,
    fontWeight: "700",
    color: farger.tekst,
  },
  sammenleggbarUndertekst: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  sammenleggbarPil: {
    fontSize: 14,
    color: "#888",
  },
  sammenleggbarInnhold: {
    padding: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  modalTittel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalTomtekst: {
    color: "#888",
    paddingVertical: 12,
  },
  modalListe: {
    flexGrow: 0,
  },
  modalRad: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalRadMedBilde: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalRadTekst: {
    flex: 1,
  },
  miniatyrBilde: {
    backgroundColor: "#eee",
  },
  miniatyrPlassholder: {
    backgroundColor: "#eef3f0",
    alignItems: "center",
    justifyContent: "center",
  },
  miniatyrBokstav: {
    color: farger.primaer,
    fontWeight: "700",
  },
  modalRadTittel: {
    fontSize: 15,
    color: farger.tekst,
  },
  modalRadUndertekst: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  antallRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  antallKnapp: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  antallKnappTekst: {
    fontSize: 22,
    fontWeight: "700",
    color: farger.mork,
  },
  antallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 10,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: farger.tekst,
  },
  antallHurtigRad: {
    flexDirection: "row",
    gap: 8,
  },
  antallHurtigKnapp: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#eef3f0",
    alignItems: "center",
  },
  antallHurtigTekst: {
    fontSize: 13,
    fontWeight: "600",
    color: farger.primaer,
  },
  antallTilgjengelig: {
    fontSize: 13,
    color: "#888",
  },
  antallAdvarsel: {
    fontSize: 13,
    color: farger.feilTekst,
    fontWeight: "600",
  },
  kort: {
    borderWidth: 1,
    borderColor: farger.kant,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  seksjonsTittel: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  feilBoks: {
    backgroundColor: farger.feilBg,
    borderRadius: 10,
    padding: 14,
  },
  feilBoksTekst: {
    color: farger.feilTekst,
  },
  tomListeTekst: {
    color: "#888",
    fontStyle: "italic",
  },
});
