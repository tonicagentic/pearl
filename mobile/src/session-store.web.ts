// No browser equivalent of the device Keychain. Keep the bearer credential
// only in this tab's memory; refreshing or closing the tab signs out. Do not
// put it in localStorage, sessionStorage, or a readable cookie.
export type StoredSession = {
  readonly cookie: string;
  readonly email: string;
};

let session: StoredSession | null = null;

export async function saveSession(cookie: string, email: string) {
  session = { cookie, email };
}

export async function loadSession(): Promise<StoredSession | null> {
  return session;
}

export async function clearSession() {
  session = null;
}

type SessionInvalidListener = () => void;
let invalidListener: SessionInvalidListener | null = null;

export function onSessionInvalid(listener: SessionInvalidListener) {
  invalidListener = listener;
  return () => {
    if (invalidListener === listener) invalidListener = null;
  };
}

export function sessionInvalid() {
  invalidListener?.();
}
