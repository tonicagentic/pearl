/**
 * User-facing capability copy for marketplace plugins.
 * Aligned with agent connection allowlists and built-in tools; not a security boundary.
 */

import type { ConnectionId } from "../connections/catalog";
import type {
  AccountPluginId,
  BuiltinPluginId,
  MarketplacePluginId,
  TonicPluginId,
} from "./catalog";

export type PluginCapabilities = {
  readonly canDo: readonly string[];
  readonly needsApproval: readonly string[];
};

type MarketplaceConnectionId = AccountPluginId | TonicPluginId;

const CONNECTION_CAPABILITIES: Record<
  MarketplaceConnectionId,
  PluginCapabilities
> = {
  gmail: {
    canDo: [
      "Search and read threads and messages in your Gmail",
      "List labels and drafts",
      "Create email drafts in your account",
    ],
    needsApproval: ["Send mail (always asks before sending)"],
  },
  drive: {
    canDo: [
      "Search files in your Google Drive",
      "Read Docs, Sheets, Slides, and other Drive file content you can access",
      "Open recent files and check file permissions",
    ],
    needsApproval: [],
  },
  calendar: {
    canDo: [
      "List your calendars and upcoming events",
      "Search events and read event details",
      "Suggest meeting times from free/busy",
    ],
    needsApproval: [],
  },
  github: {
    canDo: [
      "Search repositories you can access",
      "Read file contents, issues, and pull requests",
      "Support coding and review work with the Coder agent",
    ],
    needsApproval: [],
  },
  vercel: {
    canDo: [
      "List teams and projects on your Vercel account",
      "Inspect deployments and project details",
      "Search Vercel documentation in context",
    ],
    needsApproval: [],
  },
  tempo: {
    canDo: [
      "Search and resolve people, companies, and deals in Tempo",
      "Read meeting, proposal, and history context",
      "List outstanding CRM work and clarifications",
    ],
    needsApproval: [
      "Create or update CRM records, tasks, and notes",
      "Import prospects or log meetings",
    ],
  },
};

const BUILTIN_CAPABILITIES: Partial<
  Record<BuiltinPluginId, PluginCapabilities>
> = {
  "schema-designer": {
    canDo: [
      "Search your saved concept schemas when a term must be unambiguous",
      "Load a full definition (statement, includes, excludes, distinctions)",
      "Interview you one question at a time to draft a precise schema",
    ],
    needsApproval: [
      "Create, update, or retire a concept schema (always asks before saving)",
    ],
  },
  expo: {
    canDo: [
      "Start an Expo cloud iOS simulator and show the preview on Computer",
      "Publish an EAS Update to a pinned app’s channel",
      "Start an EAS iOS build and submit to TestFlight when asked",
    ],
    needsApproval: [
      "Simulator start, EAS Update, EAS build, and EAS submit (always)",
    ],
  },
};

/** Capabilities for a marketplace plugin / connection id. */
export function capabilitiesForConnection(
  id: ConnectionId | MarketplaceConnectionId,
): PluginCapabilities | null {
  if (id in CONNECTION_CAPABILITIES) {
    return CONNECTION_CAPABILITIES[id as MarketplaceConnectionId];
  }
  return null;
}

/** Capabilities for any catalog plugin id (connectable or built-in). */
export function capabilitiesForPlugin(
  id: MarketplacePluginId | string,
): PluginCapabilities | null {
  if (id in CONNECTION_CAPABILITIES) {
    return CONNECTION_CAPABILITIES[id as MarketplaceConnectionId];
  }
  if (id in BUILTIN_CAPABILITIES) {
    return BUILTIN_CAPABILITIES[id as BuiltinPluginId] ?? null;
  }
  return null;
}
