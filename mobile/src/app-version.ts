import Constants from "expo-constants";
import * as Updates from "expo-updates";

/** Marketing / runtime version from the Expo config (e.g. `0.1.0-alpha.6`). */
export function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    "unknown"
  );
}

/**
 * Short line for Settings: app version, plus channel / OTA id when updates
 * are enabled so you can confirm which bundle is running.
 */
export function getAppVersionDetail(): string {
  const version = getAppVersion();
  if (__DEV__ || !Updates.isEnabled) return version;

  const channel = Updates.channel;
  const updateId = Updates.updateId?.slice(0, 8);
  if (Updates.isEmbeddedLaunch) {
    return channel ? `${version} · ${channel}` : version;
  }
  if (updateId) return `${version} · ${updateId}`;
  return channel ? `${version} · ${channel}` : version;
}
