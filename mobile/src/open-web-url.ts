import { Linking, Platform } from "react-native";
import { router } from "expo-router";

/** True when the URL can be previewed in the in-app browser. */
export function isInAppWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Open http(s) links in the in-app browser; everything else uses the system handler. */
export function openWebUrl(url: string): void {
  if (Platform.OS === "web" || !isInAppWebUrl(url)) {
    openWebUrlExternally(url);
    return;
  }
  router.push({
    pathname: "/browser",
    params: { url },
  });
}

/** Hand the URL to Safari / Chrome / the OS. */
export function openWebUrlExternally(url: string): void {
  void Linking.openURL(url).catch(() => {});
}
