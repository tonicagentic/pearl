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

This app uses **Expo Router** with a drawer layout (`app/_layout.tsx`) whose content mirrors the web sidebar (New session, Issues, chat threads, account). Routes live in `app/` — every file there is a screen; keep non-route code in `components/` and `src/`. The custom entry (`index.ts`) imports `./global.css` (uniwind) and patches streaming fetch before `expo-router/entry`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

**Phone / device installs:** always use profile **`preview`** (or `production`). Never ship a phone build with profile `development` — that enables `developmentClient` and requires a Metro/dev server on the device. Reserve `development` for explicit development-client work only.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Phone builds for Alex must not require a local bundler: `eas build --profile preview` (or `production`). Do not use `--profile development` for “build on my phone”.
- Expo Go only includes its bundled native modules. After adding a library with native code, a **development client** (local `npx expo run:ios|android`, or `eas build --profile development`) is needed for Metro-based iteration — that is separate from phone preview installs.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
