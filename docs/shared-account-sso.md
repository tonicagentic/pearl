# Shared account: Pearl + Pearl Money + Pearl Tasks

Pearl, Pearl Money, and Pearl Tasks use the same better-auth user. System Autofill and iOS silent SSO need Associated Domains, Digital Asset Links, and a shared Keychain access group.

## Server env (Pearl / pearl.tonicagentic.com)

| Variable | Purpose |
|----------|---------|
| `APPLE_TEAM_ID` | Apple Team ID used in AASA `webcredentials.apps` (`TEAMID.com.tonicagentic.pearl`, `…pearlmoney`, `…pearltasks`) |
| `ANDROID_CERT_FINGERPRINTS` | Comma-separated SHA-256 fingerprints of the Android signing cert(s) for the apps (EAS/Play) |
| `FINANCE_APP_URL` | Optional Pearl Money web origin added to better-auth `trustedOrigins` |

Endpoints (deployed with this app):

- `GET /.well-known/apple-app-site-association`
- `GET /.well-known/assetlinks.json`

Verify after deploy: open those URLs on the production host (no redirect). AASA must list all three app IDs once `APPLE_TEAM_ID` is set.

## Mobile env (Expo apps)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_APPLE_TEAM_ID` | Same Team ID; builds the Keychain `accessGroup` (`TEAMID.com.tonicagentic.pearl.shared`) |
| `EXPO_PUBLIC_PEARL_URL` / `EXPO_PUBLIC_AGENT_URL` | Production: `https://pearl.tonicagentic.com` so Autofill matches the AASA domain |

## Native config

- `ios.associatedDomains`: `webcredentials:pearl.tonicagentic.com`
- `ios.entitlements.keychain-access-groups`: `$(AppIdentifierPrefix)com.tonicagentic.pearl.shared`
- Bundle / package: `com.tonicagentic.pearl`, `com.tonicagentic.pearlmoney`, `com.tonicagentic.pearltasks`
- Scheme: `pearl` / `pearlmoney` / `pearltasks`
- Shared Keychain service: `com.tonicagentic.pearl.shared.session`

## Build notes

- Associated Domains and Keychain sharing require a **development client or EAS build**, not Expo Go.
- All apps must be signed with the **same Apple team**.
- After changing entitlements / Associated Domains, rebuild native binaries (`eas build` or `npx expo prebuild` + run).

## Device checks

1. Save Pearl password in iCloud Keychain → companion apps offer the same credential.
2. Sign into Pearl → open Pearl Tasks → signed in without re-entering password (shared Keychain).
3. Sign out of either → the other requires sign-in after relaunch.
