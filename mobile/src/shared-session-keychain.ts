// Shared Keychain item used by Pearl and Pearl Money so both apps can reuse
// the same better-auth bearer on one device (iOS Keychain access group).
// Requires a development / EAS build with keychain-access-groups entitlement
// and EXPO_PUBLIC_APPLE_TEAM_ID. No-ops in Expo Go (native module absent).

import { NativeModules, Platform } from "react-native";

export const SHARED_KEYCHAIN_SERVICE = "com.tonicagentic.pearl.shared.session";

type KeychainModule = typeof import("react-native-keychain");

let cachedKeychain: KeychainModule | null | undefined;

function loadKeychain(): KeychainModule | null {
  if (cachedKeychain !== undefined) return cachedKeychain;

  // Expo Go has no RNKeychainManager; importing the package would crash auth.
  if (
    !NativeModules.RNKeychainManager &&
    !(NativeModules as { RNKeychain?: unknown }).RNKeychain
  ) {
    cachedKeychain = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedKeychain = require("react-native-keychain") as KeychainModule;
  } catch {
    cachedKeychain = null;
  }
  return cachedKeychain;
}

function sharedAccessGroup(): string | null {
  const teamId = process.env.EXPO_PUBLIC_APPLE_TEAM_ID?.trim();
  if (!teamId || Platform.OS !== "ios") return null;
  return `${teamId}.com.tonicagentic.pearl.shared`;
}

function keychainOptions(Keychain: KeychainModule) {
  const accessGroup = sharedAccessGroup();
  if (!accessGroup) return null;
  return {
    service: SHARED_KEYCHAIN_SERVICE,
    accessGroup,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  } as const;
}

export async function writeSharedSessionToken(token: string): Promise<void> {
  const Keychain = loadKeychain();
  if (!Keychain || !token) return;
  const options = keychainOptions(Keychain);
  if (!options) return;
  try {
    await Keychain.setGenericPassword("pearl", token, options);
  } catch {
    // Expo Go / missing entitlement — local SecureStore still works.
  }
}

export async function readSharedSessionToken(): Promise<string | null> {
  const Keychain = loadKeychain();
  if (!Keychain) return null;
  const options = keychainOptions(Keychain);
  if (!options) return null;
  try {
    const result = await Keychain.getGenericPassword({
      service: options.service,
      accessGroup: options.accessGroup,
    });
    if (!result) return null;
    return result.password || null;
  } catch {
    return null;
  }
}

export async function clearSharedSessionToken(): Promise<void> {
  const Keychain = loadKeychain();
  if (!Keychain) return;
  const options = keychainOptions(Keychain);
  if (!options) return;
  try {
    await Keychain.resetGenericPassword({
      service: options.service,
      accessGroup: options.accessGroup,
    });
  } catch {
    // ignore
  }
}
