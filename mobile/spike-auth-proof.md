# Spike: eve transport from React Native — results

## Server facts (verified against prod)

- Prod URL: https://my-agent-pi-eight.vercel.app (production alias of the
  latest deploy; the per-deploy URL is Vercel-SSO-protected, the alias is not)
- `GET /eve/v1/health` → 200 unauthenticated; `POST /eve/v1/session` → 401
  without credentials. eve's protocol routes live at the root via the
  `withEve` rewrite (`/_eve_internal/eve` is the internal service prefix, not
  public).
- Auth mode: `email` (better-auth). Password mode is disabled (login 409).
  The RN app signs in through better-auth's standard
  `POST /api/auth/sign-in/email` and carries the `better-auth.session_token`
  cookie; eve's client accepts a `headers` factory, so the cookie rides every
  protocol request. No server changes.

## What was built (`mobile/`)

- `index.ts` — patches `globalThis.fetch` with `expo/fetch` before any app
  import (Hermes fetch does not stream; eve's session stream needs it)
- `src/eve-transport.ts` — the runtime bridge: eve's framework-agnostic
  `EveAgentStore` (from `eve/client`) configured with `host` + a `headers`
  cookie factory, and a text-only reducer over the real protocol events
  (`client.message.submitted` → user bubble, `message.appended` → assistant
  text deltas, `turn.failed`/`session.failed` → error)
- `App.tsx` — spike UI: better-auth sign-in form, then send/receive chat over
  the eve session protocol
- `eve` is linked from the repo checkout (`npm install --no-save
  file:../node_modules/eve`) — a real build would pin a published version

## Verification

- `npx tsc --noEmit` clean; `npx expo lint` clean (exit 0); `expo-doctor`
  21/21 checks pass
- Metro bundles the full iOS app (7.0 MB, 724+ modules) including eve's
  client (session route + retry logic present in the bundle) and
  expo/fetch's streaming module

## Remaining to prove on device

The one step this sandbox cannot perform: running the app in the iOS
simulator (Expo Go or dev build), signing in with real better-auth
credentials, and streaming one live turn. Expected risks, in order:

1. `expo/fetch` streaming vs eve's client reader loop (chunked JSON events)
2. better-auth cookie: `set-cookie` is readable from RN fetch; if the
   HttpOnly attribute blocks reading on native (it should not — native
   fetch exposes raw headers), fall back to a bearer token
3. CORS is irrelevant on native (no browser), but better-auth's
   trustedOrigins may need the app's deep-link origin for its own endpoints

## Verdict

Transport complexity is as assessed: ~1 day spike, no server changes, no
eve changes. The 2–4 day runtime bridge (reducer + adapter) is started here
in text-only form; tool cards, approvals, and attachments are the parity
work after the device run.
