# Shared account: Pearl + Pearl Money

Pearl and Pearl Money use the same better-auth user. System Autofill and iOS silent SSO need Associated Domains, Digital Asset Links, and a shared Keychain access group.

## Server env (my-agent / pearl.tonicagentic.com)

| Variable | Purpose |
|----------|---------|
| `APPLE_TEAM_ID` | Apple Team ID used in AASA `webcredentials.apps` (`TEAMID.com.tonicagentic.pearl` and `…pearlmoney`) |
| `ANDROID_CERT_FINGERPRINTS` | Comma-separated SHA-256 fingerprints of the Android signing cert(s) for both apps (EAS/Play) |
| `FINANCE_APP_URL` | Optional Pearl Money web origin added to better-auth `trustedOrigins` |

Endpoints (deployed with this app):

- `GET /.well-known/apple-app-site-association`
- `GET /.well-known/assetlinks.json`

Verify after deploy: open those URLs on the production host (no redirect). AASA must list both app IDs once `APPLE_TEAM_ID` is set.

## Mobile env (both Expo apps)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_APPLE_TEAM_ID` | Same Team ID; builds the Keychain `accessGroup` (`TEAMID.com.tonicagentic.pearl.shared`) |
| `EXPO_PUBLIC_PEARL_URL` / `EXPO_PUBLIC_AGENT_URL` | Production: `https://pearl.tonicagentic.com` so Autofill matches the AASA domain |

## Native config (already in `app.json`)

- `ios.associatedDomains`: `webcredentials:pearl.tonicagentic.com`
- `ios.entitlements.keychain-access-groups`: `$(AppIdentifierPrefix)com.tonicagentic.pearl.shared`
- Bundle / package: `com.tonicagentic.pearl` and `com.tonicagentic.pearlmoney`
- Scheme: `pearl` / `pearlmoney`

## Build notes

- Associated Domains and Keychain sharing require a **development client or EAS build**, not Expo Go.
- Both apps must be signed with the **same Apple team**.
- After changing entitlements / Associated Domains, rebuild native binaries (`eas build` or `npx expo prebuild` + run).

## Device checks

1. Save Pearl password in iCloud Keychain → Pearl Money sign-in offers the same credential.
2. Sign into Pearl → open Pearl Money → signed in without re-entering password (shared Keychain).
3. Sign out of either → the other requires sign-in after relaunch.
