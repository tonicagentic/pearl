# Pearl

Pearl is a personal agent for thinking, research, writing, and responsibilities, built on the eve framework. Before writing code, always read the relevant guide in `node_modules/eve/dist/docs/public/`.

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
