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

import { EveAgentStore, defaultMessageReducer, type EveMessageData, type EveMessagePart } from 'eve/client';
import type { ThreadMessageLike } from '@assistant-ui/react-native';
import { isAttachmentMarker } from './attachment-content';

// Agent endpoint: defaults to the production alias. For local testing against
// `pnpm dev` in the repo, set EXPO_PUBLIC_AGENT_URL=http://<mac-ip>:3000 in
// mobile/.env and restart Metro (env is inlined at bundle time).
export const AGENT_URL =
  process.env.EXPO_PUBLIC_AGENT_URL ?? 'https://my-agent-pi-eight.vercel.app';

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

// Project text and authoritative user file metadata from eve. Reasoning, tool
// calls, and approvals remain separate parity work. File events never contain
// raw bytes: after reloading, render a name chip unless eve gives a safe URL.
//
// The mapping deliberately omits `id`: eve renames the user message when the
// authoritative server stream replaces the optimistic echo
// (`optimistic:<submissionId>:user` -> `turn_0:user`), and the external-store
// runtime never evicts vanished ids — a renamed message would linger as a
// sibling branch, rendering a "2 / 2" branch picker around every turn.
// Omitting the id lets the runtime assign its positional fallback ids, which
// are stable across the handoff, so the swap updates the message in place.
export function toThreadMessages(state: SpikeState): ThreadMessageLike[] {
  return state.messages.map((message) => {
    const documentParts = message.role === 'user'
      ? message.parts.filter((part): part is Extract<EveMessagePart, { type: 'text' }> =>
          part.type === 'text' &&
          (part.text.startsWith('[Attached PDF: ') || part.text.startsWith('[Attached text file: ')))
      : [];
    const attachments = message.role === 'user'
      ? message.parts.filter((part) => part.type === 'file').map((part, index) => ({
          id: `${message.id}:file:${index}`,
          type: (part.mediaType.startsWith('image/') ? 'image' : 'document') as 'image' | 'document',
          name: part.filename ?? 'Attachment',
          contentType: part.mediaType,
          status: { type: 'complete' as const },
          content: part.url && part.mediaType.startsWith('image/')
            ? [{ type: 'image' as const, image: part.url }]
            : [],
        })).concat(documentParts.map((part, index) => ({
          id: `${message.id}:document:${index}`,
          type: 'document' as const,
          name: part.text.startsWith('[Attached PDF: ')
            ? part.text.slice('[Attached PDF: '.length).split(' — ')[0]
            : part.text.slice('[Attached text file: '.length).split(']')[0],
          contentType: part.text.startsWith('[Attached PDF: ') ? 'application/pdf' : 'text/plain',
          status: { type: 'complete' as const },
          content: [],
        })))
      : [];
    return {
      role: message.role,
      content: message.parts
        .filter((part): part is Extract<EveMessagePart, { type: 'text' }> =>
          part.type === 'text' && !documentParts.includes(part) &&
          !isAttachmentMarker(part.text))
        .map((part) => ({ type: 'text' as const, text: part.text })),
      ...(attachments.length ? { attachments } : {}),
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
    };
  });
}
