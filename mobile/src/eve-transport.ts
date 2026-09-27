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
import type { ThreadMessageLike } from '@assistant-ui/react-native';

// Agent endpoint: defaults to the production alias. For local testing against
// `pnpm dev` in the repo, set EXPO_PUBLIC_AGENT_URL=http://<mac-ip>:3000 in
// mobile/.env and restart Metro (env is inlined at bundle time).
export const AGENT_URL =
  process.env.EXPO_PUBLIC_AGENT_URL ?? 'https://my-agent-pi-eight.vercel.app';

// Session cookie captured at sign-in (memory only for the spike; SecureStore
// in a real build). Empty on the local-dev path: eve's localDev()
// authenticator accepts cookie-less requests on a development server.
let authCookie: string | null = null;

export function setAuthCookie(cookie: string | null) {
  authCookie = cookie;
}

export type SpikeState = EveMessageData;

let store: EveAgentStore<SpikeState> | null = null;

export function getStore(): EveAgentStore<SpikeState> {
  if (!store) {
    store = new EveAgentStore<SpikeState>({
      host: AGENT_URL,
      headers: () =>
        authCookie ? { cookie: authCookie } : ({} as Record<string, string>),
      reducer: defaultMessageReducer(),
    });
  }
  return store;
}

// Text-only projection for the spike. Reasoning, tool calls, approvals and
// attachments are intentionally dropped — that is the remaining parity work.
//
// The mapping deliberately omits `id`: eve renames the user message when the
// authoritative server stream replaces the optimistic echo
// (`optimistic:<submissionId>:user` -> `turn_0:user`), and the external-store
// runtime never evicts vanished ids — a renamed message would linger as a
// sibling branch, rendering a "2 / 2" branch picker around every turn.
// Omitting the id lets the runtime assign its positional fallback ids, which
// are stable across the handoff, so the swap updates the message in place.
export function toThreadMessages(state: SpikeState): ThreadMessageLike[] {
  return state.messages.map((message) => ({
    role: message.role,
    content: message.parts
      .filter((part) => part.type === 'text')
      .map((part) => ({ type: 'text' as const, text: part.text })),
    // fromThreadMessageLike rejects status on user messages; only the
    // streaming assistant message needs the explicit running status.
    ...(message.role === 'assistant'
      ? {
          status:
            message.metadata?.status === 'streaming'
              ? ({ type: 'running' } as const)
              : ({ type: 'complete', reason: 'stop' } as const),
        }
      : {}),
  }));
}
