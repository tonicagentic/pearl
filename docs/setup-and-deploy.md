# Setup and Deployment

This guide covers the database-free starter, local development, long-term memory, the production persistence upgrade, Sign in with Vercel, and optional connections.

## Prerequisites

- Node.js 24 or newer
- pnpm through Corepack
- A Vercel account
- Vercel CLI, either installed globally or run with `pnpm dlx`

```bash
corepack enable
pnpm install
pnpm dlx vercel@latest login
```

The commands below use `vercel`. If you do not have a global install, replace `vercel` with `pnpm dlx vercel@latest`.

## One-Click Deploy

The README deploy button creates a working starter without Marketplace products or migrations. It asks for:

```bash
EVE_CHAT_PASSWORD=
```

Use a strong value; 16+ characters are recommended. The app exchanges it for a secure, HTTP-only session cookie. Chats and eve session cursors are stored in the current browser's localStorage, so history does not follow the user to another browser.

The deploy button does not provision storage for long-term memory. The agent runs normally, but memory is disabled on Vercel until you complete [Long-Term Memory](#long-term-memory). That step works in starter mode and does not require the production upgrade.

Starter mode is for one trusted operator. Everyone who knows the password shares
the same eve principal and any user-scoped connection grants. Upgrade to
production mode before giving independent users access.

If `EVE_CHAT_PASSWORD` is absent and the full production environment is not configured, the deployment fails closed and does not allow chat requests.

## Long-Term Memory

`agent/memory/profile.ts` gives the agent a small, model-maintained document of durable facts and preferences per eve principal. In starter mode every password holder shares one document; in production mode each signed-in user has their own. Memory is optional in every mode.

On Vercel the slot stays disabled, and the agent has no memory tools, until a private Blob store is connected. Link the project (see [Local Project Link](#local-project-link)) and run:

```bash
pnpm exec eve integration setup file-memory --yes
```

The command creates or reuses a private Vercel Blob store, connects it to Production, Preview, and Development with OIDC, and pulls the `EVE_MEMORY_BLOB_*` environment variables into `.env.local`. Blob usage may incur charges. Redeploy after running it; environment changes apply to new deployments only. The setup script below runs the same command.

This template enables memory only from the `EVE_MEMORY_BLOB_*` variables. A store you attach manually with the generic `BLOB_*` variables is ignored, so memory never takes over an application's own Blob store. In local development eve keeps memory in process and it resets when the dev server restarts.

## Production Persistence Upgrade

Configure Vercel Blob, Neon, Upstash, and Sign in with Vercel to switch the same codebase into production mode. Production mode uses Vercel identity, per-user long-term memory in private Blob storage, database-backed per-user history, and distributed rate limiting. The setup script automates this path:

```bash
./scripts/setup.sh
# Or: ./scripts/setup.sh --scope <team-slug>
```

Once all production environment variables are present, production mode takes precedence over `EVE_CHAT_PASSWORD`. Run migrations after the first production deployment:

```bash
vercel env run -e production -- pnpm db:migrate
```

## Hosted billing

The hosted production app bills new accounts by default: **$10/month** subscription via Stripe Checkout (web/Android) or StoreKit (iOS), plus metered usage. Stripe subscribers are invoiced through Metronome onto the same Stripe customer. Apple subscribers get a **$50/period included soft cap** plus optional StoreKit consumable credit packs; power users can enable automatic usage billing on the web (Stripe card + Metronome) without leaving Apple as the base subscription. New accounts start with a **$50/month usage spend cap** they can raise in Settings.

Required production env vars (see [.env.example](../.env.example)):

```bash
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
METRONOME_API_TOKEN=
METRONOME_RATE_CARD_ID=
```

For iOS StoreKit (App Store Connect products + In-App Purchase key):

```bash
APPLE_IAP_SUBSCRIPTION_ID=pearl_monthly
APPLE_IAP_USAGE_PRODUCT_IDS=pearl_usage_10:1000,pearl_usage_25:2500,pearl_usage_50:5000
APPLE_IAP_ISSUER_ID=
APPLE_IAP_KEY_ID=
APPLE_IAP_PRIVATE_KEY=
APPLE_APP_APPLE_ID=6834637706
APPLE_APP_BUNDLE_IDENTIFIER=com.tonicagentic.pearl
```

Point the Stripe webhook at `https://<your-production-host>/api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `charge.refunded`, and `radar.early_fraud_warning.created`.

Point App Store Server Notifications V2 at `https://<your-production-host>/api/billing/apple/notifications`.

The migration that adds billing marks every existing `user` row as `billing_exempt` (a free pass: no Checkout, no invoices, no cap). New signups are billed. Spend for free-pass accounts is still written to the local ledger and never ingested to Metronome.

Self-hosted production installs that should not charge anyone set:

```bash
PEARL_BILLING=off
```

Starter mode, the shared password, and local development never bill.

Friend-beta and Apple review logins skip Checkout. Their emails belong on `PEARL_TRIAL_ALLOWLIST` (production and preview). The TestFlight reviewer always uses the shared account in [TestFlight review account](testflight-review.md), never a tester's personal email. Redeploy production after editing the allowlist.

## Local Project Link

Create or select the Vercel project that will run this template:

```bash
vercel link
```

If you are working in a team, pass the team scope:

```bash
vercel link --scope <team-slug>
```

## Production Storage

The setup script provisions the required storage, including the Blob store described in [Long-Term Memory](#long-term-memory). Neon and Upstash Redis are required only for production mode.

Provision Neon:

```bash
vercel integration add neon
```

Provision Upstash Redis:

```bash
vercel integration add upstash
```

Follow the prompts and connect both resources to the linked project.

When Neon is created through the import flow, `DATABASE_URL` is usually marked sensitive and applied to Production and Preview. That is fine for deployed migrations with `vercel env run`. Select Development for the Neon env var only if you want `DATABASE_URL` to be pulled into `.env.local`; selecting Development will make it available to local dev.

Pull local env vars if you are running the app locally:

```bash
vercel env pull .env.local --yes
```

## Better Auth Secret

Generate a production-safe secret:

```bash
openssl rand -base64 32
```

Add it to every Vercel environment:

```bash
printf '%s' "<generated-secret>" | vercel env add BETTER_AUTH_SECRET production preview development
```

Pull the value locally if needed:

```bash
vercel env pull .env.local --yes
```

## Sign in with Vercel

Create a Vercel App / OAuth client in the Vercel dashboard for the account or team that owns the project. Start with the [Sign in with Vercel prerequisites](https://vercel.com/docs/sign-in-with-vercel/getting-started#prerequisites).

Required scopes:

```text
openid
email
profile
```

In the Vercel App dashboard UI, open the app's scopes/permissions settings and toggle all three scopes on. These are Vercel App permissions, not environment variables.

The email scope is mandatory. Without it, Better Auth redirects to:

```text
/auth/error?error=email_not_found
```

Add callback URLs for every origin you will use:

```text
http://localhost:3000/api/auth/callback/vercel
http://localhost:3001/api/auth/callback/vercel
https://<your-project-production-domain>/api/auth/callback/vercel
https://<your-custom-domain>/api/auth/callback/vercel
```

Use the `3001` callback only if you run local dev on port 3001. Add custom-domain callbacks only after you know the domain.

Copy the Vercel App client ID and client secret, then add them:

```bash
printf '%s' "<client-id>" | vercel env add NEXT_PUBLIC_VERCEL_APP_CLIENT_ID production preview development
printf '%s' "<client-secret>" | vercel env add VERCEL_APP_CLIENT_SECRET production preview development
```

Pull the updated values locally:

```bash
vercel env pull .env.local --yes
```

`NEXT_PUBLIC_VERCEL_APP_CLIENT_ID` is intentionally public. `VERCEL_APP_CLIENT_SECRET` and `BETTER_AUTH_SECRET` must stay secret.

You can create the OAuth app from the CLI:

```bash
vercel oauth-apps register \
  --name "eve Chat Template" \
  --slug "eve-chat-template" \
  --redirect-uri "https://<your-project-production-domain>/api/auth/callback/vercel"
```

After using the CLI, verify scopes and the client secret in the Vercel dashboard before relying on sign-in. See the [OAuth Apps CLI docs](https://vercel.com/docs/cli/oauth-apps).

## App URL

The app derives the auth origin in this order:

```text
BETTER_AUTH_URL -> VERCEL_PROJECT_PRODUCTION_URL -> VERCEL_URL -> http://localhost:3000
```

Production primary domain is **`https://pearl.diy`**. Set it explicitly:

```bash
printf '%s' "https://pearl.diy" | vercel env add BETTER_AUTH_URL production preview development
```

Keep `pearl.tonicagentic.com` on the project (trusted origin) during cutover. Mobile production builds use `EXPO_PUBLIC_AGENT_URL=https://pearl.diy` in `mobile/eas.json`.

`VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are Vercel system env vars. See [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

## Google and Apple sign-in

Better Auth accepts browser OAuth on web and **native ID tokens** on mobile (`POST /api/auth/sign-in/social`). Register callbacks:

```text
https://pearl.diy/api/auth/callback/google
https://pearl.diy/api/auth/callback/apple
```

### Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth consent screen → app **Pearl**, authorized domain `pearl.diy`.
2. Credentials → Create OAuth client ID (same project):
   - **Web** — redirect URIs: `https://pearl.diy/api/auth/callback/google`, optional `http://localhost:3000/api/auth/callback/google`.
   - **iOS** — bundle ID `com.tonicagentic.pearl`.
   - **Android** (optional) — package `com.tonicagentic.pearl` + SHA-1.
3. Vercel / `.env.local`:

```bash
GOOGLE_CLIENT_ID=<web-client-id>
GOOGLE_CLIENT_SECRET=<web-secret>
GOOGLE_IOS_CLIENT_ID=<ios-client-id>
GOOGLE_ANDROID_CLIENT_ID=<android-client-id>   # optional
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web-client-id>  # shows web button
```

4. Mobile EAS / Expo env:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
```

5. After the iOS client exists, set the Google Sign-In Expo plugin URL scheme in `mobile/app.json` to the **reversed** iOS client ID (e.g. client `123-abc.apps.googleusercontent.com` → scheme `com.googleusercontent.apps.123-abc`), then ship a new native build.

### Apple Developer

1. App ID `com.tonicagentic.pearl` → enable **Sign In with Apple**.
2. Services ID e.g. `com.tonicagentic.pearl.web` → domains `pearl.diy` (+ `pearl.tonicagentic.com` while dual-hosting) → return URL `https://pearl.diy/api/auth/callback/apple` (HTTPS only; no localhost).
3. Keys → Sign In with Apple → download `.p8` once; note Key ID and Team ID.
4. Vercel / `.env.local`:

```bash
APPLE_CLIENT_ID=com.tonicagentic.pearl.web
APPLE_APP_BUNDLE_IDENTIFIER=com.tonicagentic.pearl
APPLE_TEAM_ID=<team-id>
APPLE_KEY_ID=<key-id>
APPLE_PRIVATE_KEY="<pem with \n newlines>"
NEXT_PUBLIC_APPLE_CLIENT_ID=com.tonicagentic.pearl.web
```

5. Mobile already enables `usesAppleSignIn` + `expo-apple-authentication`. Rebuild with EAS **preview** or **production** after env is set (not OTA-only).

## Database Migrations

Run production migrations after the first deployment and after any schema change:

```bash
vercel env run -e production -- pnpm db:migrate
```

There is also a package script:

```bash
pnpm db:migrate:production
```

For local development, load `.env.local` before running Drizzle:

```bash
set -a
source .env.local
set +a
pnpm db:migrate
```

For local prototyping only, you can use:

```bash
set -a
source .env.local
set +a
pnpm db:push
```

See the [Vercel env run docs](https://vercel.com/docs/cli/env) for more examples.

### Pearl Money / Plaid freshness columns

Finance schema migrations are not part of `pnpm db:migrate` (they live under
`lib/finance/db/migrations/`). After pulling code that adds
`plaid_items.last_refreshed_at` / `last_synced_at`, apply as the Neon **owner**
role (not `finance_app`):

```bash
# Neon SQL editor, or:
DATABASE_URL_UNPOOLED='postgresql://…' node scripts/apply-plaid-freshness-migration.mjs
```

Also enable the **Transactions Refresh** add-on in the Plaid Dashboard, and
ensure `PEARL_OWNER_EMAIL` is set so `/api/v1/plaid/webhook` can sync under RLS.
Optional: `PLAID_WEBHOOK_URL=https://<host>/api/v1/plaid/webhook`.

## Run Locally

Start the app:

```bash
pnpm dev
```

Or run it on port 3001:

```bash
PORT=3001 pnpm dev -p 3001
```

Open the matching local URL and make sure the Vercel App contains the same callback URL.

## Optional Vercel Connect Integrations

Slack is optional and is not part of the required deploy button flow. Gmail, Google Calendar, Google Drive, Google Sheets, GitHub, Vercel, Expo, Neon, Better Stack, Xero, and Tempo MCP are optional and user-scoped: each signed-in person authorizes their own account from Settings (web or mobile) or through the in-chat Connect card. Expo, Neon, and Better Stack are connected from Profile → Coder. Public multi-tenant deploys need Better Auth (`email` / `vercel`), not shared-password mode, for per-user plugins.

Create any connectors you want to use:

```bash
# Slack channel
vercel connect create slack --name eve-chat-template --triggers
vercel connect attach <slack-connector-uid> --triggers --trigger-path /eve/v1/slack --yes

# Gmail is first-party REST (not Google's MCP). Enable the Gmail API in Google
# Cloud, create a Web OAuth client with redirect
# https://connect.vercel.com/callback, then:
#   vercel connect create google --connection-method oauth --name pearl-gmail \
#     --data @.secrets/pearl-gmail-oauth.json
# where the JSON has { "clientId", "clientSecret" }. Set GMAIL_CONNECTOR to the
# returned UID. Scopes: gmail.readonly, gmail.compose, gmail.modify.
#
# Calendar / Drive still use Workspace MCP (developer preview). Enable those
# MCP APIs, create a Web OAuth client marked for an AI-powered agent, then:
vercel connect create https://calendarmcp.googleapis.com/mcp/v1 --name calendar
vercel connect create https://drivemcp.googleapis.com/mcp/v1 --name drive

# Google Sheets MCP (developer preview, same Google Cloud project and OAuth
# client as above). Also enable the Google Sheets API and the Google Sheets MCP
# API (sheetsmcp.googleapis.com). Override the endpoint with SHEETS_MCP_URL if
# Google moves it. The server has no create-spreadsheet tool; Pearl reads and
# edits sheets you already have. Writes need approval each call.
vercel connect create https://sheetsmcp.googleapis.com/mcp/v1 --name sheets

# Tempo (company CRM) MCP: Streamable HTTP with OAuth through Better Auth's mcp
# plugin on the CRM app. Set TEMPO_MCP_URL to your Tempo MCP endpoint and use
# the same URL here. Tempo writes need approval.
vercel connect create "$TEMPO_MCP_URL" --name tempo

# User-scoped GitHub hosted MCP (OAuth bearer accepted by the readonly server;
# do not use the managed GitHub App installation method). A bare
# clientId/clientSecret create does not support user grants — use a create
# payload with userAuthorization + GitHub OAuth discovery:
#   .secrets/pearl-github-connect-create.json → clientId, clientSecret,
#   userAuthorization.enabled, refreshTokens.enabled, defaultResource
#   https://api.githubcopilot.com/mcp/readonly, and serverConfig from
#   https://github.com/login/oauth/.well-known/openid-configuration
# GitHub OAuth App callback: https://connect.vercel.com/callback
vercel connect create https://api.githubcopilot.com/mcp/readonly --name pearl-github \
  --data @.secrets/pearl-github-connect-create.json

# User-scoped Vercel MCP (select None / user OAuth when prompted).
vercel connect create vercel --name vercel

# User-scoped Expo MCP (https://mcp.expo.dev/mcp). OAuth issuer is
# https://mcp.expo.dev, scope mcp:access, redirect
# https://connect.vercel.com/callback. Dynamic client registration is on the
# Expo authorization server. Pearl mounts this connection on the coder
# subagent; users connect from Profile → Coder → Expo.
vercel connect create https://mcp.expo.dev/mcp --name pearl-expo

# User-scoped Neon MCP (https://mcp.neon.tech/mcp). OAuth scopes read + write.
# Pearl mounts this on the coder subagent; users connect from Profile → Coder → Neon.
vercel connect create https://mcp.neon.tech/mcp --name pearl-neon

# User-scoped Better Stack MCP (https://mcp.betterstack.com). Managed Connect
# creation may 404 ("Connect is not enabled for this team"); use OAuth DCR + a
# BYO connector instead. Register a public client (auth method none) against
# Better Stack, then create the connector with userAuthorization enabled:
#   curl -sS -X POST https://betterstack.com/oauth/register \
#     -H 'Content-Type: application/json' \
#     -d '{"client_name":"Pearl (Vercel Connect)","redirect_uris":["https://connect.vercel.com/callback"],"grant_types":["authorization_code","refresh_token"],"response_types":["code"],"token_endpoint_auth_method":"none","scope":"read write"}'
# Put clientId + serverConfig (issuer https://betterstack.com, authorize/token/
# register endpoints, scopes read+write) in
# .secrets/pearl-betterstack-connect-create.json with userAuthorization.enabled
# and refreshTokens.enabled, defaultResource https://mcp.betterstack.com.
# Pearl mounts this on the coder subagent; users connect from Profile → Coder →
# Better Stack.
vercel connect create https://mcp.betterstack.com --name pearl-betterstack \
  --connector-type oauth --data @.secrets/pearl-betterstack-connect-create.json

# User-scoped Xero Remote MCP (https://api.xero.com/mcp/v1). Create a Xero Web
# app (not Custom Connection) at https://developer.xero.com/app/manage with
# redirect URI https://connect.vercel.com/callback. Enable granular
# accounting.*.read and report scopes (new apps cannot use deprecated
# accounting.transactions / accounting.reports.read). Put clientId/clientSecret
# in .secrets/pearl-xero-oauth.json, then build a Connect create payload that
# enables userAuthorization with Xero's OAuth discovery endpoints (a bare
# clientId/clientSecret create does not support user grants):
#   .secrets/pearl-xero-connect-create.json → clientId, clientSecret,
#   userAuthorization.enabled, refreshTokens.enabled, defaultResource
#   https://api.xero.com/mcp/v1, and serverConfig from
#   https://identity.xero.com/.well-known/openid-configuration
vercel connect create https://api.xero.com/mcp/v1 --name pearl-xero \
  --data @.secrets/pearl-xero-connect-create.json
# Pearl's authorize route and agent connection pass scopes from
# lib/connections/oauth-scopes.ts. Prefer the api.xero.com URL over
# `vercel connect create xero` (mcp.xero.com), which rejected BYO Web-app tokens.
```

Attach each connector to the linked Vercel project if needed:

```bash
vercel connect attach <connector-uid> --yes
```

Set the matching environment variable to each connector UID (never put provider tokens in these variables):

```bash
printf '%s' "<slack-connector-uid>" | vercel env add SLACK_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add GMAIL_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add CALENDAR_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add DRIVE_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add GITHUB_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add VERCEL_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add EXPO_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add NEON_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add BETTERSTACK_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add XERO_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add SHEETS_CONNECTOR production preview development
printf '%s' "<connector-uid>" | vercel env add TEMPO_CONNECTOR production preview development
# Required when TEMPO_CONNECTOR is set:
printf '%s' "https://your-tempo.example/api/mcp" | vercel env add TEMPO_MCP_URL production preview development
# Optional Sheets MCP endpoint override:
printf '%s' "https://sheetsmcp.googleapis.com/mcp/v1" | vercel env add SHEETS_MCP_URL production preview development
```

Refresh local values without overwriting local-only secrets: a full
`vercel env pull .env.local` can erase them, so pull to a temporary file and
merge only the desired lines. Restart local dev or redeploy after changes.

Gmail, Calendar, Drive, Sheets, GitHub, Vercel, Expo, Xero, and Tempo stay
unavailable until their connector env vars are set and the connectors are
attached. Tempo also requires `TEMPO_MCP_URL`.

### iCloud Calendar (CalDAV)

iCloud Calendar does not use Vercel Connect. Pearl stores an encrypted Apple
app-specific password per linked account and talks to `caldav.icloud.com`.

1. Generate a 32-byte key: `openssl rand -base64 32`
2. Set it on the project (and locally in `.env.local`):

```bash
printf '%s' "<base64-key>" | vercel env add ICLOUD_CALDAV_CREDENTIALS_KEY production preview development
```

3. Run database migrations so `icloud_calendar_account` exists (`pnpm db:migrate`
   or your usual Neon migrate path).
4. Users connect from Settings → Calendar (mobile) or Plugins → iCloud Calendar
   (web) with their Apple ID and an [app-specific password](https://support.apple.com/en-us/102654).

Without `ICLOUD_CALDAV_CREDENTIALS_KEY`, the iCloud Calendar UI shows as
unavailable; Google Calendar still works via `CALENDAR_CONNECTOR`.

The same AES-GCM helper encrypts bearers for **Connected agents** (private eve
deployments Pearl calls as remote agents). Prefer `USER_SECRETS_KEY` (same
32-byte base64 or 64-hex format); if unset, Pearl falls back to
`ICLOUD_CALDAV_CREDENTIALS_KEY`. Users add agents under Settings → Connected
agents. On each private deployment, accept that bearer on the eve channel and
set `EVE_CALLBACK_TRUSTED_ORIGINS` to this Pearl origin.

### Gmail (REST + Vercel Connect)

Gmail does **not** use Google's MCP server. Pearl calls `gmail.googleapis.com`
with Connect-issued user tokens:

- Read/search: `search_gmail_threads`, `get_gmail_thread`, `get_gmail_message`,
  `list_gmail_labels`, `list_gmail_drafts`
- Draft: `create_gmail_draft` (approval every call)
- Send: `send_gmail_message` (approval + execution ledger)
- Bulk archive / mark-read / label: `apply_mail_batch` (approval)

Google Cloud setup:

1. Enable **Gmail API** only (not Gmail MCP API).
2. OAuth consent screen (External / Testing is fine for personal use) with
   scopes `gmail.readonly`, `gmail.compose`, `gmail.modify`.
3. Create a **Web application** OAuth client with redirect URI
   `https://connect.vercel.com/callback`. No “AI-powered agent” flag needed.
4. Add every mailbox address as a Test user while the app is in Testing.
5. `vercel connect create google --connection-method oauth --name pearl-gmail --data @.secrets/pearl-gmail-oauth.json`
   then attach and set `GMAIL_CONNECTOR`.

Multiple Gmail accounts share that connector. Each mailbox is a separate
Connect grant (legacy first account uses the Better Auth user id as the
subject; additional accounts use `{userId}:gmail:{mailboxId}`).

Until those env vars are set, Settings shows Unavailable for that service and
the agent does not register the connection. Shared-password and local
development principals cannot authorize user-scoped grants; use a personal
Better Auth account (email or Sign in with Vercel).

Web Settings → Plugins and mobile Settings → Plugins list all configured
account connections, plus built-in tools and Tonic Agentic agents. Users can
Connect, Check status, and Disconnect accounts. Connect owns the OAuth
callback and stores the per-user grant; the app never receives provider
tokens. If a chat requires MCP authorization first, use the Connect card in
the chat UI.

See [Deploy Button integrations](https://vercel.com/docs/integrations/deploy-button/integrations) for how storage products are declared in the deploy URL.

## Deploy

Build locally before deploying:

```bash
pnpm build
```

Deploy to production:

```bash
pnpm exec vercel deploy --prod
```

A Git push does not guarantee that the production alias has moved. In particular,
the iOS app calls the deployed `/api/chats/[id]/sync` endpoint to save a pending
message **before** sending a follow-up to eve. If the mobile app supports a newer
sync request than the deployed server, the old route can return `400 Nothing to
sync.` and the draft will remain unsent. After changing that endpoint or the
mobile persistence client, inspect the production alias with
`pnpm exec vercel inspect <production-domain>` and deploy the server if it still
points to an older release. Verify a first message **and** a follow-up on an
authenticated device before declaring the mobile send path healthy. Do not
re-send a turn whose delivery is uncertain.

After changing env vars, storage products, or Connect connectors, redeploy so production uses the newest project configuration.

## Troubleshooting

If chat is disabled and says setup is required, check the tooltip. Missing migrations will show as `database migrations`. Run:

```bash
vercel env run -e production -- pnpm db:migrate
```

If sign-in redirects to `/auth/error?error=email_not_found`, enable the email scope in your Vercel App. See [Sign in with Vercel scopes](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions).

If sign-in redirects to `/auth/error?error=invalid_scope`, make sure the Vercel App has `openid`, `email`, and `profile` enabled.

If sign-in redirects to an auth error after the OAuth consent screen, confirm that the callback URL exactly matches your browser origin, including port and `/api/auth/callback/vercel`.

If `pnpm db:migrate` says `DATABASE_URL` is missing, either run `vercel env run -e production -- pnpm db:migrate` for production or pull a Development-scoped Neon env var into `.env.local`.

If rate limiting setup is missing, provision Upstash Redis and pull env vars again.

If a user-scoped plugin stays Unavailable, confirm the matching `*_CONNECTOR`
env var is set, the connector is attached with user authorization, and local
env vars have been pulled again. Tempo also needs `TEMPO_MCP_URL`.

## Useful Links

- [Shared account SSO (Pearl + Pearl Money)](shared-account-sso.md)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Vercel env run](https://vercel.com/docs/cli/env)
- [Vercel Marketplace storage](https://vercel.com/docs/storage)
- [Vercel CLI integration commands](https://vercel.com/docs/cli/integration)
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Sign in with Vercel prerequisites](https://vercel.com/docs/sign-in-with-vercel/getting-started#prerequisites)
- [Sign in with Vercel scopes](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions)
- [Shared account SSO (Pearl + Pearl Money + Pearl Tasks)](shared-account-sso.md)
