import './global.css';

// Spike: stream-capable fetch must be global BEFORE any module that calls
// fetch at import time (eve's client builds fetch calls lazily, but the patch
// is cheapest first). RN/Hermes' global fetch buffers responses; expo/fetch
// supports streaming bodies, which eve's session stream requires.
import { fetch as expoFetch } from 'expo/fetch';

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = expoFetch as unknown as typeof fetch;
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
