# Pearl

An open-source personal agent for clear thinking.

Pearl is a web and iOS app for thinking, research, writing, and keeping track of what matters. It maintains context about you over time, allowing it to understand your preferences, projects, and other relevant information.

## Features

### Thinking partner

* Turn unorganized thoughts into well-reasoned ideas.
* Develop, challenge, and connect ideas through conversation.
* Remember relevant facts and tailor responses to you.

### Research assistant

* Ask questions and get reliable, cited answers.
* Research information across the web and other available sources.
* Synthesize findings across multiple sources.

### Writing assistant

* Turn ideas into written communication.
* Draft, critique, and revise writing collaboratively.
* Create and edit Markdown files alongside the agent.

### Responsibilities tracker

* Track unresolved responsibilities and issues.
* Bring responsibilities back to your attention when appropriate.
* Keep track of deadlines and relevant context.
* Visualize your responsibilities on a mind map.

## Quick Start

### Requirements

* Node.js (see `packageManager` in `package.json` for the pinned pnpm version)
* [pnpm](https://pnpm.io)
* For the iOS app: Node.js and either [Expo Go](https://expo.dev/go) on a device or simulator, or Xcode for a development build

### Web app

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

By default, local development runs with a local development identity and keeps chats in browser storage — no services required. To require a password locally, add this to `.env.local`:

```bash
EVE_CHAT_PASSWORD=<at-least-16-characters>
```

### iOS app

The iOS app lives in `mobile/` and talks to the web app's agent over your local network:

```bash
# Terminal 1 — the agent (from the repo root)
pnpm dev

# Terminal 2 — the iOS app
cd mobile
npm install
npx expo start
```

Point the app at your machine's dev server by putting your LAN IP in `mobile/.env`:

```bash
EXPO_PUBLIC_AGENT_URL=http://<your-lan-ip>:3000

# Optional: skip the sign-in gate for local development (local dev servers
# accept requests anonymously).
EXPO_PUBLIC_SKIP_SIGN_IN=1
```

Then open the printed URL in Expo Go, or press `i` to launch the iOS simulator. The first request can take a minute or two while the agent compiles.

Useful checks inside `mobile/`:

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npx expo-doctor    # dependency and config diagnostics
```

## Configuration

Starter mode needs nothing beyond an optional password. Production mode (Neon-backed history, Upstash rate limiting, Sign in with Vercel, per-user long-term memory) takes precedence when its complete environment is present, and the app fails closed when neither mode is configured on a deployment.

| Mode | Selected when | Authentication | Chat persistence | Long-term memory |
| --- | --- | --- | --- | --- |
| Starter | `EVE_CHAT_PASSWORD` is configured | Shared password and secure session cookie | Browser localStorage | Shared Vercel Blob document after setup |
| Production | Neon, Upstash, and all Sign in with Vercel variables are configured | Sign in with Vercel | Neon | Per-user Vercel Blob document |
| Local development | Neither mode is configured and `next dev` is running locally | Local development identity | Browser localStorage | Process-local |

All variables are listed with comments in [.env.example](.env.example). For the full upgrade path — including `./scripts/setup.sh`, long-term memory, and Vercel Connect integrations — see [Setup and Deployment](docs/setup-and-deploy.md).

## Project Structure

| Path | What it is |
| --- | --- |
| `agent/` | The agent: instructions, tools, and per-user long-term memory |
| `app/`, `components/`, `lib/` | The Next.js web app |
| `mobile/` | The iOS app (Expo + [assistant-ui](https://www.assistant-ui.com) native elements) |
| `docs/` | Architecture, setup, and design notes |
| `evals/`, `tests/` | Behavioral evals and tests |

## Documentation

* [Setup and Deployment](docs/setup-and-deploy.md) — starter and production setup flows
* [How the Chatbot Works](docs/how-the-chatbot-works.md) — runtime architecture, streaming model, persistence, and extension points
* [React Native / iOS exploration](docs/react-native-ios-exploration.md) — how the mobile app bridges to the agent

## Roadmap

* Profile: Additional settings and preferences, including structured personal information such as clothing sizes.
* Memory: More advanced long-term memory and context management.
* Personal ontology: A structured representation of the people, projects, places, organizations, and concepts relevant to you.
* Data connections: Connections to additional sources of personal context.
* File storage: More robust file storage, organization, and retrieval.
* Security and privacy: Additional security, privacy, and data-handling checks and review.

## Changelog

Changes to Pearl are documented in the [changelog](CHANGELOG.md).

## Status

Pearl is under active development. Interfaces, data models, and behavior may change as the project evolves.

## License

Distributed under the [Apache License 2.0](LICENSE). Third-party attributions are listed in the [NOTICE](NOTICE) file.
