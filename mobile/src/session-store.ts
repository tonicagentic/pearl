// Durable session storage: the better-auth bearer credential (and email)
// live in the device Keychain via expo-secure-store, so a signed-in session
// survives app restarts. The token is also mirrored into a shared Keychain
// access group so Pearl Money / Pearl Tasks can reuse the same session on
// this device.
//
// Expiry is not tracked locally: a stale credential simply starts failing with
// 401s, and callers report that through sessionInvalid() so the auth provider
// clears both disk and memory state.

import * as SecureStore from "expo-secure-store";
import {
  clearSharedSessionToken,
  readSharedSessionToken,
  writeSharedSessionToken,
} from "./shared-session-keychain";

const COOKIE_KEY = "pearl.session_cookie";
const EMAIL_KEY = "pearl.viewer_email";

export type StoredSession = {
  readonly cookie: string;
  readonly email: string;
};

export async function saveSession(cookie: string, email: string) {
  await SecureStore.setItemAsync(COOKIE_KEY, cookie);
  await SecureStore.setItemAsync(EMAIL_KEY, email);
  await writeSharedSessionToken(cookie);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [cookie, email] = await Promise.all([
    SecureStore.getItemAsync(COOKIE_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);

  if (cookie) {
    return { cookie, email: email ?? "" };
  }

  // Adopt a session written by Pearl Money / Pearl Tasks (or a prior Pearl install).
  const shared = await readSharedSessionToken();
  if (!shared) {
    return null;
  }

  await SecureStore.setItemAsync(COOKIE_KEY, shared);
  return { cookie: shared, email: email ?? "" };
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await clearSharedSessionToken();
}

// 401 handling: API clients call sessionInvalid() when a request that carried
// the stored cookie is rejected; the auth provider subscribes here and signs
// the user out.
type SessionInvalidListener = () => void;
let invalidListener: SessionInvalidListener | null = null;

export function onSessionInvalid(listener: SessionInvalidListener) {
  invalidListener = listener;
  return () => {
    if (invalidListener === listener) {
      invalidListener = null;
    }
  };
}

export function sessionInvalid() {
  invalidListener?.();
}
