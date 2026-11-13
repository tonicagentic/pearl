/**
 * Check for an EAS Update on cold start. When a newer bundle is available,
 * download it and reload so the user does not need a second force-quit.
 * No-op in __DEV__, when updates are disabled, or when the native module
 * is missing (Expo Go / client without expo-updates linked).
 */
export async function applyUpdatesOnLaunch(): Promise<void> {
  if (__DEV__) return;
  try {
    const Updates = await import("expo-updates");
    if (!Updates.isEnabled) return;
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Missing native module, offline, or channel/runtime mismatch —
    // leave the embedded/current bundle.
  }
}
