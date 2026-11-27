This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

Root `app/_layout.tsx` is an auth-gated **Stack** (sign-in, workbench, browser modal, Settings fullScreenModal). Signed-in destinations live under **`app/(drawer)/`**: an Expo Router `Drawer` (`drawerType: "back"`) with custom `drawerContent` (New Chat, Automations, Goals, Library, Finances, Projects with +, recent chats, Profile avatar).

- **Drawer siblings:** `(home)` (New Chat + Chat|Overview switcher), `automations`, `goals`, `library`, `finances`, `workspaces`, `history`. Detail-only (no drawer hub): `tasks`, `notes`. Parked: `agents` (redirects home).
- **Root modal:** `app/settings/**` — fullScreenModal over the drawer (circular X / nested back; header search filters the index list).
- **Nested stacks only for details:** `tasks/[id]`, `automations/new|edit`, `workspaces/projects/...`, `settings/*` children.
- Non-route UI lives in `components/` (`navigation/`, `home/`, `tasks/`, `library/`, `workspaces/`, `history/`, `settings/`) and `src/`.

The custom entry (`index.ts`) imports `./global.css` (uniwind) and patches streaming fetch before `expo-router/entry`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

**Phone / device installs:** always use profile **`preview`** (or `production`). Never ship a phone build with profile `development` — that enables `developmentClient` and requires a Metro/dev server on the device. Reserve `development` for explicit development-client work only.

**OTA updates:** follow `$eas-update`. Runtime must match the installed binary (`appVersion` policy); wrong `expo.version` means the phone silently ignores the update.

**Beta App Review** signs in as `test@tonicagentic.com` / `pearl-test`. That account stays on `PEARL_TRIAL_ALLOWLIST`. Never put a tester's email in the App Store Connect demo login. Standard: `docs/testflight-review.md`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Phone builds for Alex must not require a local bundler: `eas build --profile preview` (or `production`). Do not use `--profile development` for “build on my phone”.
- Expo Go only includes its bundled native modules. After adding a library with native code, a **development client** (local `npx expo run:ios|android`, or `eas build --profile development`) is needed for Metro-based iteration — that is separate from phone preview installs.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
