# React Native iOS client — exploration

Goal: an iOS interface for the personal agent. Branch is a working record of
the assessment; nothing here is shipped.

## Verdict

A real but bounded project — **not** a wire-up. Three workstreams, roughly:

| Workstream | Effort | Risk |
| --- | --- | --- |
| Transport: auth + eve session protocol from Expo | ~1 day spike | Low, de-riskable first |
| Runtime bridge: eve events → `@assistant-ui/react-native` | 2–4 days | Medium — the real work |
| Native UI (thread, thread list, tool cards) | 3–5 days MVP, 1–2 wks parity | Low, mostly mechanical |

An MVP (text chat + streaming + thread list, no tool cards) is plausibly a
week of focused work. Web-level parity (task/artifact cards, approvals,
attachments, canvas) is the long tail.

## The one wrong assumption

"Share components with the web UI" mostly does not hold. assistant-ui is
strict about it — the RN docs warn: install **only**
`@assistant-ui/react-native` in a native app. `@assistant-ui/react` (web)
pulls Radix + DOM primitives into the native bundle, and a second copy of the
shared core breaks `useAui`. Every web element under
`components/assistant-ui/elements/` imports `@assistant-ui/react` or DOM —
none can ship in the RN app.

What **does** share (verified imports):

- `app/_components/model-selection.ts` — framework-agnostic store ✓
- `lib/chat/title.ts`, `lib/chat/limits.ts`, `lib/chat/large-paste.ts`,
  `lib/chat/types.ts` — pure logic ✓
- `lib/chat/persistence-client.ts`, `provisional-chat.ts`, `events.ts` —
  fetch-based, shareable in principle ✓
- **Gap:** `lib/chat/message-reducer.ts` imports `defaultMessageReducer` from
  `eve/react`, which re-exports `@assistant-ui/react` (web-only). Extracting
  the reducer into a platform-neutral module is the one nontrivial refactor
  needed before logic-sharing works cleanly.

## Connecting to eve

eve has **no React Native client** (docs cover Next.js/Nuxt/SvelteKit/Vue
only), but the pieces are all header-driven HTTP — no browser dependency:

- **Auth** (`lib/eve-auth.ts`): both paths authenticate from request headers.
  better-auth mode uses `auth.api.getSession({ headers })` — a native app can
  carry the session cookie (SecureStore) or a bearer token (better-auth
  bearer plugin). Password mode reads a custom header. Either way the eve
  channel is native-friendly unchanged.
- **Session protocol**: `POST /api/eve/session` (+ per-session send routes)
  returning a streamed event body. eve's own `Client`/`ClientSession`
  (dist/src/client) is plain `fetch` — usable from RN **if** streaming fetch
  exists. Hermes' global fetch does not stream; Expo's `expo/fetch` does
  (SDK 51+). The eve client does not accept a fetch injection
  (constructor takes only `host`/`auth`/`headers`/`redirect`), so the spike
  patches `globalThis.fetch` with `expo/fetch` in the app entry — a standard
  Expo pattern, but **the #1 thing to verify on device first**.
- **Runtime bridge** (`@assistant-ui/react-native`): the install docs confirm
  external-store APIs ship in the RN package. The web's `useEveAgentRuntime`
  (from `eve/react`) is web-only; the RN app re-implements a thin runtime on
  `EveAgentStore` (framework-agnostic: snapshot + subscribe + dispatch are
  plain JS) feeding the RN external-store hook. The web message converter +
  `createChatMessageReducer` define the mapping; reuse after the reducer
  extraction.
- **What NOT to use**: the RN `ChatModelAdapter` lane (`/api/chat` style) —
  it would bypass eve's sessions entirely and lose tools, approvals,
  compaction, and durable history. `RemoteThreadListAdapter` maps well to
  `lib/chat`'s API for the thread list, but the turn protocol still needs the
  eve session stream.

## Suggested sequencing

1. **Transport spike (de-risk)**: Expo app, `expo/fetch` global patch,
   authenticate to the deployed prod URL, create a session, stream one real
   turn end-to-end. No assistant-ui yet. Kill/continue decision point.
2. **Runtime bridge**: extract `message-reducer` to platform-neutral code,
   feed `EveAgentStore` snapshots into the RN external store, render text
   turns.
3. **UI**: `npx assistant-ui add thread thread-list` (native registry),
   Uniwind + the same color tokens as the web kit, thread list via the chat
   API. Model picker port is trivial (the store already shares).
4. **Parity pass**: native tool cards (task-card, artifact-card, thinking),
   HITL approvals, attachments, markdown rendering.

## Device/dev notes

- Expo dev client on the iOS simulator talks to `localhost:3000` dev server
  directly; TestFlight builds need the prod URL + a signing team (EAS).
- Push notifications for task completion (the notification ledger) would be a
  separate Expo Notifications project — out of scope for MVP.

## Open questions

- Does `expo/fetch` streaming satisfy eve's client (chunked JSON events,
  keep-alive reconnection)?
- better-auth on RN: cookie persistence vs bearer plugin — confirm which the
  deployed auth mode allows (email/vercel modes use better-auth; the personal
  deployment's mode is whatever `setup` configured).
- Approvals/HITL in native UI — needed for personal use, or defer?
