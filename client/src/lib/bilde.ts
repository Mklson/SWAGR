// Kamera + komprimering for varebilder. Komprimerer på enheten før opplasting
// slik at et telefonfoto på flere MB blir ~250-400 KB - sparer lagringskvote,
// opplastingstid og (for gjenkjenning) tokens mot Claude.
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAKS_BREDDE = 1280;
const KVALITET = 0.7;

export interface KomprimertBilde {
  /** Bar base64 (uten "data:"-prefiks), JPEG. */
  base64: string;
  /** Lokal fil-URI for forhåndsvisning. */
  uri: string;
}

function utenPrefiks(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, "");
}

/** Komprimerer et bilde fra en lokal URI til ~1280px JPEG. */
export async function komprimerBilde(uri: string): Promise<KomprimertBilde> {
  const ref = await ImageManipulator.manipulate(uri)
    .resize({ width: MAKS_BREDDE, height: null })
    .renderAsync();
  const lagret = await ref.saveAsync({ format: SaveFormat.JPEG, compress: KVALITET, base64: true });
  return { base64: utenPrefiks(lagret.base64 ?? ""), uri: lagret.uri };
}

/**
 * Åpner kamera og returnerer et komprimert bilde, eller null hvis brukeren
 * avbrøt eller nektet kamera-tilgang.
 */
export async function taBilde(): Promise<KomprimertBilde | null> {
  const tillatelse = await ImagePicker.requestCameraPermissionsAsync();
  if (!tillatelse.granted) {
    Alert.alert(
      "Kamera-tilgang kreves",
      "SWAGR trenger tilgang til kamera for å fotografere varer.",
    );
    return null;
  }
  const valg = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (valg.canceled || !valg.assets[0]?.uri) return null;
  return komprimerBilde(valg.assets[0].uri);
}
