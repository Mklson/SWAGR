// Kamera + komprimering for varebilder. Komprimerer på enheten før opplasting
// slik at et telefonfoto på flere MB blir ~250-400 KB - sparer lagringskvote,
// opplastingstid og (for gjenkjenning) tokens mot Claude.
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat, manipulateAsync } from "expo-image-manipulator";

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

// Ny kontekst-API (SDK 54+). Kan feile på enkelte web-oppsett.
async function komprimerNy(uri: string): Promise<KomprimertBilde> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: MAKS_BREDDE }).renderAsync();
  const lagret = await ref.saveAsync({ format: SaveFormat.JPEG, compress: KVALITET, base64: true });
  return { base64: utenPrefiks(lagret.base64 ?? ""), uri: lagret.uri };
}

// Eldre API - «deprecated but still functional», bredest plattformstøtte.
async function komprimerGammel(uri: string): Promise<KomprimertBilde> {
  const res = await manipulateAsync(uri, [{ resize: { width: MAKS_BREDDE } }], {
    format: SaveFormat.JPEG,
    compress: KVALITET,
    base64: true,
  });
  return { base64: utenPrefiks(res.base64 ?? ""), uri: res.uri };
}

/** Komprimerer et bilde fra en lokal URI til ~1280px JPEG. */
export async function komprimerBilde(uri: string): Promise<KomprimertBilde> {
  try {
    return await komprimerNy(uri);
  } catch (err) {
    console.warn("[bilde] ny manipulator-API feilet, faller tilbake til manipulateAsync", err);
    return komprimerGammel(uri);
  }
}

// Komprimer et valgt bilde; faller tilbake til kameraets/bibliotekets rå
// base64 hvis komprimeringen feiler helt (typisk web).
async function fraAsset(asset: ImagePicker.ImagePickerAsset): Promise<KomprimertBilde> {
  try {
    return await komprimerBilde(asset.uri);
  } catch (err) {
    console.warn("[bilde] komprimering feilet, bruker rått bilde", err);
    if (asset.base64) return { base64: utenPrefiks(asset.base64), uri: asset.uri };
    throw err;
  }
}

/**
 * Åpner kamera og returnerer et komprimert bilde, eller null hvis brukeren
 * avbrøt eller nektet kamera-tilgang.
 */
export async function taBilde(): Promise<KomprimertBilde | null> {
  const tillatelse = await ImagePicker.requestCameraPermissionsAsync();
  if (!tillatelse.granted) {
    Alert.alert("Kamera-tilgang kreves", "SWAGR trenger tilgang til kamera for å fotografere varer.");
    return null;
  }
  const valg = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    base64: true,
  });
  if (valg.canceled || !valg.assets[0]?.uri) return null;
  return fraAsset(valg.assets[0]);
}

/**
 * Åpner enhetens bildebibliotek og returnerer et komprimert bilde, eller
 * null hvis brukeren avbrøt eller nektet tilgang.
 */
export async function velgBildeFraBibliotek(): Promise<KomprimertBilde | null> {
  const tillatelse = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!tillatelse.granted) {
    Alert.alert("Tilgang kreves", "SWAGR trenger tilgang til bildebiblioteket for å legge til varebilder.");
    return null;
  }
  const valg = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    base64: true,
  });
  if (valg.canceled || !valg.assets[0]?.uri) return null;
  return fraAsset(valg.assets[0]);
}
