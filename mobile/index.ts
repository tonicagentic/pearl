import './global.css';

// eve's SessionStore calls `crypto.randomUUID()` for optimistic submissions.
// Hermes has no `crypto` global, and `crypto.randomUUID?.()` still throws
// "Property 'crypto' doesn't exist" before optional chaining can help.
try {
  const ExpoCrypto = require('expo-crypto') as {
    getRandomValues: <T extends ArrayBufferView>(typedArray: T) => T;
    randomUUID: () => string;
  };
  const crypto =
    (globalThis as { crypto?: Crypto }).crypto ??
    ({} as Pick<Crypto, 'getRandomValues' | 'randomUUID'>);
  if (typeof crypto.getRandomValues !== 'function') {
    crypto.getRandomValues = ExpoCrypto.getRandomValues;
  }
  if (typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = ExpoCrypto.randomUUID;
  }
  (globalThis as { crypto: typeof crypto }).crypto = crypto;
} catch {
  // Fast-refresh race or missing native module: leave whatever is installed.
}

// Spike: stream-capable fetch must be global BEFORE any module that calls
// fetch at import time (eve's client builds fetch calls lazily, but the patch
// is cheapest first). RN/Hermes' global fetch buffers responses; expo/fetch
// supports streaming bodies, which eve's session stream requires.
//
// The native module lookup throws when a fast refresh re-runs this entry
// while the runtime is mid-teardown ("runtime not ready"). The patch from the
// first load is still installed on globalThis, so catching and continuing
// keeps fast refresh working instead of killing the app registration.
try {
  const { fetch: expoFetch } = require('expo/fetch') as {
    fetch: typeof fetch;
  };

  // Native fetch already exists, but does not reliably expose incremental
  // response bodies to eve. Always install expo's streaming implementation.
  globalThis.fetch = expoFetch as unknown as typeof fetch;
} catch {
  // Fast-refresh race: keep the previously installed streaming fetch.
}

// Expo Router entry: registered last so the side effects above are in place
// before any route renders (docs: router/installation#custom-entry-point).
import 'expo-router/entry';
