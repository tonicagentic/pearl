import * as Updates from "expo-updates";

/**
 * Check for an EAS Update on cold start. When a newer bundle is available,
 * download it and reload so the user does not need a second force-quit.
 * No-op in __DEV__ and when updates are disabled (Expo Go / debug).
 */
export async function applyUpdatesOnLaunch(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Offline or channel/runtime mismatch — leave the embedded/current bundle.
  }
}
