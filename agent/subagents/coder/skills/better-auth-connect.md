---
description: >
  Better Auth end-user sessions and Vercel Connect user tokens for GitHub and
  Vercel. Load when adding sign-in, protecting routes, or calling APIs as the
  signed-in user. Never put Connect tokens in sandboxes or prompts.
---

# Better Auth and Connect

- End users authenticate with Better Auth. Gate mutating tools on a Better
  Auth user principal (`principalType: "user"`, issuer `better-auth`) unless
  the project documents another principal.
- GitHub and Vercel user access go through Vercel Connect connectors. Resolve
  tokens in the **app runtime** (`getToken` / project helpers), never in the
  model prompt and never as sandbox env for the whole session.
- Prefer firewall / lease brokers (`setNetworkPolicy` transforms) when a
  sandbox command must call GitHub or Vercel as the user.
- Settings → Connect is how users authorize. If a token is missing, tell them
  to connect the provider — do not invent credentials.
- Do not add a second auth library (Clerk, Auth0, NextAuth) to an app that
  already uses Better Auth unless the user explicitly asks to migrate.
