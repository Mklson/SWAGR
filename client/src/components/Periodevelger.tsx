import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { TekstFelt, VelgFelt } from "./ui";

const ALLE_PERIODER = "__alle__";
const EGENDEFINERT = "__egendefinert__";
const YTD = "__ytd__";

const NORSKE_MÅNEDER = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function datoTekst(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface PeriodeAlternativ {
  verdi: string;
  label: string;
  fra?: string;
  til?: string;
}

function genererPerioder(): PeriodeAlternativ[] {
  const nå = new Date();
  const perioder: PeriodeAlternativ[] = [
    { verdi: ALLE_PERIODER, label: "Alle perioder" },
    { verdi: YTD, label: `Hittil i år (${nå.getFullYear()})`, fra: `${nå.getFullYear()}-01-01`, til: datoTekst(nå) },
  ];
  for (let i = 0; i < 12; i++) {
    const d = new Date(nå.getFullYear(), nå.getMonth() - i, 1);
    const sisteDagIMåned = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    perioder.push({
      verdi: `maned-${d.getFullYear()}-${d.getMonth()}`,
      label: `${NORSKE_MÅNEDER[d.getMonth()]} ${d.getFullYear()}`,
      fra: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
      til: datoTekst(sisteDagIMåned),
    });
  }
  perioder.push({ verdi: EGENDEFINERT, label: "Egendefinert periode" });
  return perioder;
}

/** Delt periodevelger for rapportene: forhåndsvalg (alle perioder / hittil i
 * år / siste 12 måneder) eller egendefinert fra/til. Regner selv ut fra/til
 * for forhåndsvalgene - parent trenger kun bry seg om de to ferdige
 * datostrengene, ikke hvilket modus som er valgt. */
export function Periodevelger({
  fra,
  til,
  onFraChange,
  onTilChange,
}: {
  fra: string;
  til: string;
  onFraChange: (v: string) => void;
  onTilChange: (v: string) => void;
}) {
  const [periodeValg, setPeriodeValg] = useState<string>(ALLE_PERIODER);
  const perioder = useMemo(() => genererPerioder(), []);
  const alternativer = useMemo(() => perioder.map((p) => ({ verdi: p.verdi, label: p.label })), [perioder]);

  function velgPeriode(verdi: string) {
    setPeriodeValg(verdi);
    const p = perioder.find((p) => p.verdi === verdi);
    onFraChange(p?.fra ?? "");
    onTilChange(p?.til ?? "");
  }

  return (
    <View style={stiler.rot}>
      <VelgFelt label="Periode" valgt={periodeValg} alternativer={alternativer} onVelg={velgPeriode} />
      {periodeValg === EGENDEFINERT && (
        <View style={stiler.datoRad}>
          <View style={stiler.datoFelt}>
            <TekstFelt label="Fra" value={fra} onChangeText={onFraChange} placeholder="ÅÅÅÅ-MM-DD" />
          </View>
          <View style={stiler.datoFelt}>
            <TekstFelt label="Til" value={til} onChangeText={onTilChange} placeholder="ÅÅÅÅ-MM-DD" />
          </View>
        </View>
      )}
    </View>
  );
}

const stiler = StyleSheet.create({
  rot: {
    gap: 12,
  },
  datoRad: {
    flexDirection: "row",
    gap: 10,
  },
  datoFelt: {
    flex: 1,
  },
});
