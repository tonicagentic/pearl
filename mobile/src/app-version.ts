import Constants from "expo-constants";

type PearlExtra = {
  readonly pearlOta?: string;
};

type UpdatesModule = typeof import("expo-updates");

/** Lazy-load so a missing ExpoUpdates native module does not crash Settings. */
function loadUpdates(): UpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync; Settings reads this during render
    return require("expo-updates") as UpdatesModule;
  } catch {
    return null;
  }
}

/** Marketing / runtime version from the Expo config (e.g. `0.1.0-alpha.6`). */
export function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    "unknown"
  );
}

/** OTA label from `expo.extra.pearlOta` — free to bump without a native rebuild. */
export function getPearlOta(): string | null {
  const extra = Constants.expoConfig?.extra as PearlExtra | undefined;
  const value = extra?.pearlOta?.trim();
  return value ? value : null;
}

/**
 * Short line for Settings: app version, OTA label, channel, and update id /
 * embedded so you can confirm which bundle is running.
 */
export function getAppVersionDetail(): string {
  const version = getAppVersion();
  const ota = getPearlOta();
  const parts = [version];
  if (ota) parts.push(`ota ${ota}`);

  if (__DEV__) {
    parts.push("dev");
    return parts.join(" · ");
  }

  const Updates = loadUpdates();
  if (!Updates?.isEnabled) {
    return parts.join(" · ");
  }

  const channel = Updates.channel?.trim();
  if (channel) parts.push(channel);

  if (Updates.isEmbeddedLaunch) {
    parts.push("embedded");
  } else {
    const updateId = Updates.updateId?.slice(0, 8);
    if (updateId) parts.push(updateId);
  }

  return parts.join(" · ");
}
