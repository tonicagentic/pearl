---
name: eas-update
description: >
  Publish Expo EAS Update (OTA) bundles for Pearl mobile. Use when the user
  asks to push an Expo update, ship OTA, update the preview/production
  channel, or when phone UI changes need to reach installed builds without a
  new native binary. Covers mobile/eas.json channels, app.json
  runtimeVersion/appVersion policy, pearlOta, and apply-updates.ts.
---

# EAS Update (Pearl mobile)

Use this skill to ship JS/asset over-the-air updates to installed Pearl
builds. Work from `mobile/`.

## Hard rule: runtime must match the installed binary

`app.json` uses:

```json
"runtimeVersion": { "policy": "appVersion" }
```

An update is **only** served to builds whose native `expo.version` equals the
`expo.version` in `app.json` at publish time. Wrong runtime = phone silently
ignores the update (no error UI).

Before publishing:

1. Confirm which binary the user has (Settings version line, or EAS builds).
2. Confirm `mobile/app.json` → `expo.version` matches that runtime.
3. Never bump `expo.version` only for an OTA — that requires a new
   `eas build`. Keep version stable across OTAs until the next native build.

Typical current mapping (verify before each publish; it drifts):

| Install / channel | Profile (`eas.json`) | Runtime to publish |
| ----------------- | -------------------- | ------------------ |
| Internal preview  | `preview` → channel `preview` | whatever that preview IPA was built with (often `0.1.0-alpha.7`) |
| Store / prod binary | `production` → channel `production` | whatever that production IPA was built with (may differ from preview) |

Preview and production can have **different** runtimes. Publishing once with
the wrong version helps neither. Publish separately per channel/runtime when
they diverge.

### Confirm installed runtime

```bash
cd mobile
npx eas-cli@latest build:list --profile preview --platform ios --status finished --limit 3 --non-interactive
npx eas-cli@latest channel:view preview --non-interactive
npx eas-cli@latest update:list --branch preview --limit 5 --non-interactive
```

Read **Runtime Version** / **Version** on the latest finished build the user
actually installed. Set `expo.version` to that value before `eas update` if it
does not already match.

## Publish procedure (preview)

Default phone installs use the **preview** channel.

1. Ensure JS changes are ready (committed or at least in the working tree you
   intend to bundle).
2. Match runtime: `expo.version` == installed preview binary version.
3. Bump the human-visible OTA label (optional but recommended):

   ```json
   "extra": { "pearlOta": "<n+1>" }
   ```

   Settings shows `ota N` via `src/app-version.ts`.
4. Publish:

   ```bash
   cd mobile
   npx eas-cli@latest update \
     --channel preview \
     --environment preview \
     --message "<short user-facing summary>" \
     --non-interactive
   ```

   `--environment` is **required** with `--non-interactive`. Use `preview` for
   the preview channel and `production` for production.
5. Confirm output shows the expected **Runtime version** (not a newer unused
   version). Save the EAS Dashboard URL from the success line.
6. Tell the user to force-quit and reopen Pearl (cold start runs
   `applyUpdatesOnLaunch` in `app/_layout.tsx`). Settings should show the new
   `ota N` and a non-`embedded` update id prefix.

### Production channel

Same steps with `--channel production --environment production`, after
matching `expo.version` to the **production** binary runtime.

## Do not

- Publish with a bumped `expo.version` and expect old preview builds to
  pick it up.
- Use `--profile development` / development-client builds for “update my
  phone” — those need Metro; phone OTAs target preview/production binaries.
- Assume git push deploys the mobile app. Vercel deploys the agent web app;
  mobile OTAs are always an explicit `eas update`.
- Treat a successful publish as delivered until runtime in the publish
  output matches the phone and the user confirms Settings.

## Diagnose “phone not updating”

1. `channel:view <channel>` — latest group runtime vs phone runtime.
2. If publish runtime ≠ phone runtime → republish with matching
   `expo.version` (this is the usual failure mode).
3. Confirm channel: preview builds listen on `preview`, not `production`.
4. Confirm cold start: `applyUpdatesOnLaunch` only runs when not `__DEV__`
   and `Updates.isEnabled`.
5. Native module / Expo Go: OTA needs a real EAS binary with `expo-updates`.

## Related

- Phone build rules: `mobile/AGENTS.md` (Building with EAS).
- Launch check/reload: `mobile/src/apply-updates.ts`.
- Version/OTA display: `mobile/src/app-version.ts`.
- Channels: `mobile/eas.json` (`preview.channel`, `production.channel`).
