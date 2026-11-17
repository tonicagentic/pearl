# Pearl

Pearl is a personal agent for thinking, research, writing, and areas, built on the eve framework. Before writing code, always read the relevant guide in `node_modules/eve/dist/docs/public/`.

Use `eve` lowercase in user-facing copy, docs, prompts, and comments. Do not
title-case it unless it is part of an exact external title or quoted text.

## Model-call failures: check the OIDC token first

Symptom: every turn fails with `MODEL_CALL_FAILED` — `AI_RetryError: Failed
after 3 attempts. Last error: GatewayResponseError: Invalid error response
format: Gateway request failed`. This is usually an expired
`VERCEL_OIDC_TOKEN` in `.env.local` (the agent authenticates to the AI
Gateway with it; there is no `AI_GATEWAY_API_KEY` in this project), not a
provider outage.

1. Decode the token and check `exp`:
   `node -e "const t=require('fs').readFileSync('.env.local','utf8').match(/^VERCEL_OIDC_TOKEN=(.*)$/m)[1].replace(/^\"|\"$/g,'');console.log(new Date(JSON.parse(Buffer.from(t.split('.')[1],'base64url')).exp*1000).toISOString())"`
2. If stale, refresh it surgically — a full `vercel env pull` over
   `.env.local` would clobber local-only secrets (`BETTER_AUTH_SECRET`,
   `EVE_CHAT_PASSWORD`, …):
   `pnpm exec vercel env pull .env.oidc-refresh.tmp --yes`, then copy only
   the `VERCEL_OIDC_TOKEN=` line into `.env.local` and delete the temp file.
3. Restart the dev server (it caches the old token in memory) and resend.

The OIDC token lives ~12 hours from issue; `eve dev`/`next dev` normally
refreshes it in memory, so an outage that outlives a restart means the file
itself is stale.

## Mobile chat streaming (Expo)

Desktop parity for assistant replies on Expo: pace at ~20 wps, render Marked
on the revealed prefix while live, fade only the paced tail, then hand off to
selectable settled Marked (no whole-reply FadeIn dump).

### Do not regress these

1. **Live deltas ahead of line commits.** eve folds `content.delta` into
   `snapshot.messages` only at NDJSON `endOfLine`. Mobile accumulates every
   delta in `mobile/src/live-reply-text.ts` via `onEvent`, then
   `applyLiveReplyOverlay` in `chat-screen` merges it into projected messages.
   Treat omitted `kind` as text (eve often skips it); reject explicit non-text
   (`reasoning`, …).

2. **Reveal progress must survive remounts.** High-frequency delta re-renders
   remount the markdown tree. `useStreamingReveal` in
   `lib/streaming-text-reveal.ts` keeps module-level wall-clock progress
   (`turnShown` / `turnFadeFromWord`). Never restart the rAF loop on every
   `ready` change — that left the UI on a lone `●` cursor with a huge
   buffered backlog. Only the live (`streaming`) instance mutates that
   module state; settled/user bubbles must not reset it during render.

3. **Marked while streaming + per-word fade.**
   `StreamingMarkdownText` in `mobile/.../markdown-text.tsx` runs
   `react-native-marked` on the clipped visible prefix
   (`stabilizeStreamingMarkdown` closes dangling `**` / `` ` `` so raw
   markers do not flash). `StreamingMarkdownRenderer` wraps leaf words in
   `StreamingWord` and fades only indices `>= fadeFromWord` (catch-up floor).
   Settled path stays selectable (`TextInput` on iOS).

4. **Thinking chrome until a painted word.** Keep timeline/thinking visible
   until the answer has a finished word (`/\S+\s/`) so chrome does not die
   into a blank body. See `assistant-thinking.tsx` / `thread.aui.tsx`.

### Symptom → check

- Long blank + single `●` while Stop is active → reveal remount/rAF regress
  or live buffer rejecting deltas (`kind` gating).
- Raw `**` / `- ` mid-stream → stabilize helper or Marked path bypassed
  (plain `StreamingWord` only).
- Whole answer dumps at settle → switching to settled Marked before
  `reveal.writing` is false, or a FadeIn wrapper on settle.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
