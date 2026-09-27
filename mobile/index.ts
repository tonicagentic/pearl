import './global.css';

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

  if (typeof globalThis.fetch !== 'function') {
    globalThis.fetch = expoFetch as unknown as typeof fetch;
  }
} catch {
  // Fast-refresh race: keep the previously installed streaming fetch.
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
