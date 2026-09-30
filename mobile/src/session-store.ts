// Durable session storage: the better-auth bearer credential (and email)
// live in the device Keychain via expo-secure-store, so a signed-in session
// survives app restarts. The in-memory mirror in eve-transport stays the
// request-time source; this module is the disk copy.
//
// Expiry is not tracked locally: a stale credential simply starts failing with
// 401s, and callers report that through sessionInvalid() so the auth provider
// clears both disk and memory state.

import * as SecureStore from "expo-secure-store";

const COOKIE_KEY = "pearl.session_cookie";
const EMAIL_KEY = "pearl.viewer_email";

export type StoredSession = {
  readonly cookie: string;
  readonly email: string;
};

export async function saveSession(cookie: string, email: string) {
  await SecureStore.setItemAsync(COOKIE_KEY, cookie);
  await SecureStore.setItemAsync(EMAIL_KEY, email);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [cookie, email] = await Promise.all([
    SecureStore.getItemAsync(COOKIE_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);

  if (!cookie) {
    return null;
  }

  return { cookie, email: email ?? "" };
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
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
