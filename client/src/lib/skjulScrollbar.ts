import { Platform } from "react-native";

/** react-native-web sin showsHorizontalScrollIndicator={false} slår ikke
 * alltid av den native nettleser-scrollbaren på tvers av nettlesere (sett på
 * Windows/Chrome, ikke i headless-testing) - denne skjuler den eksplisitt
 * via CSS for elementet med gitt id (bruk sammen med nativeID på ScrollView). */
export function skjulScrollbarForId(id: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const styleId = `skjul-scrollbar-${id}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #${id} { scrollbar-width: none; -ms-overflow-style: none; }
    #${id}::-webkit-scrollbar { display: none; height: 0; width: 0; }
  `;
  document.head.appendChild(style);
}
