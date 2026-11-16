# Pearl Tasks

Companion tasks and projects app for [Pearl](https://github.com/tonicagentic/pearl).

Sign-in uses your **Pearl account** (email + password). Tasks and projects live in Pearl’s Postgres (`issue` and `project` tables). The same session is shared with Pearl (and Pearl Money) through an iOS Keychain access group.

## Stack

- Expo Router + TypeScript
- Auth via Pearl better-auth (`EXPO_PUBLIC_PEARL_URL`)
- Shared Keychain service: `com.tonicagentic.pearl.shared.session`

## Setup

```bash
cd pearl-tasks
cp .env.example .env
npm install
npm start
```

Point `EXPO_PUBLIC_PEARL_URL` at a running Pearl server (`http://localhost:3000` in the simulator, LAN IP on a device, or `https://pearl.tonicagentic.com` in production).

Set `EXPO_PUBLIC_APPLE_TEAM_ID` for silent SSO with Pearl. Associated Domains and Keychain sharing need a development client or EAS build, not Expo Go.

## Identity

- Scheme: `pearltasks`
- Bundle / package: `com.tonicagentic.pearltasks`
- Associated domain: `webcredentials:pearl.tonicagentic.com`
