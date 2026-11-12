/**
 * Display catalog for Plugins. OAuth account wiring stays in
 * lib/connections/catalog; this file is UI labels, copy, and sections only.
 */

import type { ConnectionId } from "../connections/catalog";

export type AccountPluginId =
  | "gmail"
  | "drive"
  | "calendar"
  | "github"
  | "vercel";

export type TonicPluginId = "tempo";

export type BuiltinPluginId =
  | "browser"
  | "search"
  | "coder"
  | "projects"
  | "researcher"
  | "analyst"
  | "designer"
  | "schema-designer"
  | "plan"
  | "tax";

export type ComingSoonPluginId = "expo" | "shopify" | "stripe";

export type MarketplacePluginId =
  | AccountPluginId
  | TonicPluginId
  | BuiltinPluginId
  | ComingSoonPluginId;

export type PluginMarkId = MarketplacePluginId | "sheets" | "xero";

export type PluginKind = "account" | "tonic" | "builtin" | "coming_soon";

export type PluginCatalogEntry<Id extends string = string> = {
  readonly id: Id;
  readonly label: string;
  readonly detail: string;
  readonly description: string;
};

export type ConnectablePluginEntry = PluginCatalogEntry<
  AccountPluginId | TonicPluginId
> & {
  readonly connectionId: ConnectionId;
  readonly kind: "account" | "tonic";
};

export type BuiltinPluginEntry = PluginCatalogEntry<BuiltinPluginId> & {
  readonly kind: "builtin";
};

export type ComingSoonPluginEntry = PluginCatalogEntry<ComingSoonPluginId> & {
  readonly kind: "coming_soon";
};

export type ResolvedPlugin =
  | ConnectablePluginEntry
  | BuiltinPluginEntry
  | ComingSoonPluginEntry;

/** Accounts shown in Plugins + Settings (Sheets/Xero stay wired, hidden here). */
export const ACCOUNT_PLUGINS: readonly ConnectablePluginEntry[] = [
  {
    id: "gmail",
    connectionId: "gmail",
    kind: "account",
    label: "Gmail",
    detail: "Read and manage Gmail",
    description:
      "Let Pearl read your inbox, find threads, and draft replies in your Gmail account. Sending mail always asks for your approval. Authorization is stored by Vercel Connect for your signed-in user only.",
  },
  {
    id: "drive",
    connectionId: "drive",
    kind: "account",
    label: "Google Drive",
    detail: "Drive, Docs, Sheets or Slides",
    description:
      "Search and open files in Google Drive so Pearl can pull context from Docs, Sheets, Slides, and other Drive items you can access. Grants stay scoped to your account through Vercel Connect.",
  },
  {
    id: "calendar",
    connectionId: "calendar",
    kind: "account",
    label: "Google Calendar",
    detail: "View and manage your calendar",
    description:
      "Check upcoming events, free/busy times, and schedule details from Google Calendar. Pearl uses this when you ask about meetings or planning around your day.",
  },
  {
    id: "github",
    connectionId: "github",
    kind: "account",
    label: "GitHub",
    detail: "Triage PRs, issues, CI, and publish flows",
    description:
      "Connect GitHub so Pearl can inspect repositories, pull requests, issues, and CI status for your account. Useful for coding tasks, reviews, and shipping work with the Coder agent.",
  },
  {
    id: "vercel",
    connectionId: "vercel",
    kind: "account",
    label: "Vercel",
    detail: "Projects, deployments, and logs",
    description:
      "Link Vercel to inspect projects, deployments, and runtime context for apps you own. Pearl uses this when debugging deploys or shipping with the Coder agent.",
  },
] as const;

export const TONIC_PLUGINS: readonly ConnectablePluginEntry[] = [
  {
    id: "tempo",
    connectionId: "tempo",
    kind: "tonic",
    label: "Tempo",
    detail: "CRM: people, companies, deals, and activity",
    description:
      "Tempo is Tonic Agentic’s CRM. After you authorize, Pearl can search people, companies, deals, meetings, and proposals, and propose writes that need your approval. Configure TEMPO_CONNECTOR and TEMPO_MCP_URL on the deployment.",
  },
] as const;

export const BUILTIN_PLUGINS: readonly BuiltinPluginEntry[] = [
  {
    id: "browser",
    kind: "builtin",
    label: "Web Browser",
    detail: "Open and navigate sites with Pearl",
    description:
      "Pearl can open a live browser in the shared workspace so you can look at pages together. Use it when a site needs navigation, forms, or visual confirmation beyond a one-shot fetch.",
  },
  {
    id: "search",
    kind: "builtin",
    label: "Web Search",
    detail: "Look up facts and sources on the web",
    description:
      "Quick web lookups for facts, news, and citations. Pearl also has deeper research tools when a single search is not enough; this plugin is always available.",
  },
  {
    id: "coder",
    kind: "builtin",
    label: "Coder",
    detail: "Build, PR, deploy, and EAS builds",
    description:
      "A specialized coding agent that can work in a sandbox, open PRs, deploy to Vercel, and kick off Expo/EAS builds. Pearl delegates here when you ask to build or ship software.",
  },
  {
    id: "projects",
    kind: "builtin",
    label: "Projects",
    detail: "Long-running workspaces with plans and chats",
    description:
      "Projects group related chats, instructions, and plan documents for work that outlives a single conversation. Open Projects from the drawer to create or continue one.",
  },
  {
    id: "researcher",
    kind: "builtin",
    label: "Researcher",
    detail: "Deep research with cited findings",
    description:
      "A research specialist that runs refined web searches and returns cited findings with confidence levels. Pearl uses it when a draft needs fresh facts beyond what’s already on hand.",
  },
  {
    id: "analyst",
    kind: "builtin",
    label: "Data Analyst",
    detail: "Analyze tables, metrics, and trends",
    description:
      "Help interpret tables, metrics, and trends from files or context you provide. Pearl can summarize patterns, check assumptions, and explain what the numbers suggest.",
  },
  {
    id: "designer",
    kind: "builtin",
    label: "Designer",
    detail: "Layouts, visuals, and design critique",
    description:
      "Support for layout ideas, visual direction, and design critique. Pearl can help refine UI copy, structure screens, and generate images when that capability is available.",
  },
  {
    id: "schema-designer",
    kind: "builtin",
    label: "Schema Designer",
    detail: "Precise concept definitions for unambiguous language",
    description:
      "Save concept schemas on your account when a term must be unambiguous — software meaning, claims, policies, distinctions. Pearl looks them up when precision matters, and designs new ones through a short interview. Saving or changing a schema always asks for your approval first.",
  },
  {
    id: "plan",
    kind: "builtin",
    label: "Plan",
    detail: "Research and write durable project plans",
    description:
      "Plan mode researches and writes durable plan documents on a project instead of jumping straight into implementation. Switch to Plan in the composer when you want a written approach first.",
  },
  {
    id: "tax",
    kind: "builtin",
    label: "Personal tax and finance",
    detail: "Track money, taxes, and financial context",
    description:
      "Pearl can keep personal finance and tax context in areas and memory when you share it, and help organize questions around spending, filing, and planning. It does not replace a tax professional.",
  },
] as const;

export const COMING_SOON_PLUGINS: readonly ComingSoonPluginEntry[] = [
  {
    id: "expo",
    kind: "coming_soon",
    label: "Expo",
    detail: "Mobile builds, EAS, and project tooling",
    description:
      "A dedicated Expo connection for EAS builds and project tooling is coming soon. Today, mobile build work still goes through the Coder agent and your GitHub/Vercel accounts when those are connected.",
  },
  {
    id: "shopify",
    kind: "coming_soon",
    label: "Shopify",
    detail: "Store, products, and order workflows",
    description:
      "Shopify store, product, and order workflows will connect here later. This row is a preview of the catalog; Connect is not available yet.",
  },
  {
    id: "stripe",
    kind: "coming_soon",
    label: "Stripe",
    detail: "Payments, customers, and billing data",
    description:
      "Stripe payments and customer data will connect here later for account-scoped billing context. Pearl’s own app billing remains separate under Settings → Billing.",
  },
] as const;

/** Connection ids that appear in Plugins / Settings account rows. */
export const MARKETPLACE_CONNECTION_IDS: readonly ConnectionId[] = [
  ...ACCOUNT_PLUGINS.map((item) => item.connectionId),
  ...TONIC_PLUGINS.map((item) => item.connectionId),
];

const ALL_MARKETPLACE: readonly ResolvedPlugin[] = [
  ...ACCOUNT_PLUGINS,
  ...TONIC_PLUGINS,
  ...BUILTIN_PLUGINS,
  ...COMING_SOON_PLUGINS,
];

export function isMarketplacePluginId(
  value: unknown,
): value is MarketplacePluginId {
  return (
    typeof value === "string" &&
    ALL_MARKETPLACE.some((plugin) => plugin.id === value)
  );
}

export function getPluginById(id: string): ResolvedPlugin | null {
  return ALL_MARKETPLACE.find((plugin) => plugin.id === id) ?? null;
}

export function isConnectablePlugin(
  plugin: ResolvedPlugin,
): plugin is ConnectablePluginEntry {
  return plugin.kind === "account" || plugin.kind === "tonic";
}
