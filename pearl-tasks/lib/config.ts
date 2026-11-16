import Constants from "expo-constants";

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/**
 * Pearl better-auth origin. Expo Go on a phone needs the Mac LAN IP, not
 * localhost. Override with EXPO_PUBLIC_PEARL_URL.
 */
export const PEARL_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_PEARL_URL?.trim() ||
    (Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri.split(":")[0]}:3000`
      : "http://localhost:3000"),
);
