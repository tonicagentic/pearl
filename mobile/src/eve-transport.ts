// Runtime bridge: eve's framework-agnostic EveAgentStore drives
// @assistant-ui/react-native's external-store runtime. The web template's
// useEveAgentRuntime is web-only (imports @assistant-ui/react), so this file
// re-implements the thin mapping:
//
//   EveAgentStore snapshot -> ThreadMessageLike[] + isRunning -> adapter
//
// The projection uses eve's own defaultMessageReducer (the same UIMessage-
// shaped projection the web template renders): it keeps the optimistic user
// message alive across the handoff to the authoritative server stream
// (message.received) and tracks per-message streaming status. A hand-rolled
// reducer that ignores message.received drops the user message the moment the
// server events arrive, leaving the response as a dangling generation.

import { EveAgentStore, defaultMessageReducer, type EveMessageData } from 'eve/client';
import { Platform } from 'react-native';
export { toThreadMessages } from './message-projection';

// On local web dev, use Metro's loopback-only same-origin proxy so browser
// requests keep production's CORS/CSRF protection intact. Native clients still
// contact the configured agent directly; a deployed web build needs its own
// same-origin API host. Set EXPO_PUBLIC_AGENT_URL for local backend testing.
export const AGENT_URL =
  Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    ? `${window.location.origin}/__pearl_api`
    : process.env.EXPO_PUBLIC_AGENT_URL ?? 'https://my-agent-pi-eight.vercel.app';

// Session credential captured at sign-in (mirrored to SecureStore by
// session-store). A better-auth bearer token from the sign-in response body
// (RN fetch cannot read Set-Cookie). Cleared when the user signs out.
let authCookie: string | null = null;

export function setAuthCookie(cookie: string | null) {
  authCookie = cookie;
}

export function getAuthCookie(): string | null {
  return authCookie;
}

export type SpikeState = EveMessageData;

let store: EveAgentStore<SpikeState> | null = null;

export function getStore(): EveAgentStore<SpikeState> {
  if (!store) {
    store = new EveAgentStore<SpikeState>({
      host: AGENT_URL,
      headers: () =>
        authCookie
          ? { authorization: `Bearer ${authCookie}` }
          : ({} as Record<string, string>),
      reducer: defaultMessageReducer(),
    });
  }
  return store;
}
