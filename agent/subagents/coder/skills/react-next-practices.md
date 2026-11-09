---
description: >
  React and Next.js App Router practices for Pearl-stack UIs: Server
  Components by default, small client islands, streaming, and Vercel deploy
  realities. Load when editing UI, routes, or performance-sensitive pages.
---

# React / Next practices

- App Router by default. Prefer Server Components; add `"use client"` only for
  interactivity that needs browser APIs or client state.
- Follow the project's existing component and styling system. Do not introduce
  a second UI kit or CSS approach without a clear need.
- Keep data fetching close to the server tree; avoid waterfalls. Cache and
  revalidate with the patterns the repo already uses.
- Images and fonts: use the Next helpers the project already depends on.
  Respect Core Web Vitals — no oversized client bundles for static content.
- Deploy assumptions: Node serverless / Vercel Functions unless the repo says
  otherwise. Do not require Docker, a long-lived Node server, or Chrome in the
  coding sandbox for routine Next apps.
- When the repo has React Compiler guidance or bans unnecessary
  `useMemo`/`useCallback`, follow that over older memoization habits.
