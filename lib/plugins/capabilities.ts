/**
 * User-facing capability copy for marketplace plugins.
 * Aligned with agent connection allowlists and built-in tools; not a security boundary.
 */

import type { ConnectionId } from "../connections/catalog";
import type {
  AccountPluginId,
  BuiltinPluginId,
  CredentialPluginId,
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
      "Search and read threads and messages across connected Gmail accounts",
      "List labels and drafts",
      "Create email drafts in your account",
      "Archive, mark read, and label threads (after you approve a batch)",
    ],
    needsApproval: [
      "Send mail (always asks before sending)",
      "Archive, mark read, or label in bulk",
    ],
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
    needsApproval: [
      "First push and draft pull request in a coding task",
      "Merge a pull request when checks are green",
    ],
  },
  vercel: {
    canDo: [
      "List teams and projects on your Vercel account",
      "Inspect deployments and project details",
      "Search Vercel documentation in context",
    ],
    needsApproval: [
      "Preview or production deploy with the Coder agent",
    ],
  },
  expo: {
    canDo: [
      "List Expo orgs and projects on your account",
      "Search and read Expo documentation",
      "Inspect EAS builds, workflows, Observe metrics, and TestFlight",
      "Take simulator screenshots and find views by testID",
    ],
    needsApproval: [
      "Start or stop a cloud simulator",
      "Run or cancel EAS builds and workflows",
      "Submit a build to the stores",
      "Tap, type, or scroll on a connected device",
    ],
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

const CREDENTIAL_CAPABILITIES: Record<
  CredentialPluginId,
  PluginCapabilities
> = {
  "icloud-calendar": {
    canDo: [
      "List calendars on your linked iCloud accounts",
      "List and search events in a time range",
      "Read event details (title, time, location, notes)",
    ],
    needsApproval: [],
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

/** Capabilities for any catalog plugin id (connectable, credential, or built-in). */
export function capabilitiesForPlugin(
  id: MarketplacePluginId | string,
): PluginCapabilities | null {
  if (id in CONNECTION_CAPABILITIES) {
    return CONNECTION_CAPABILITIES[id as MarketplaceConnectionId];
  }
  if (id in CREDENTIAL_CAPABILITIES) {
    return CREDENTIAL_CAPABILITIES[id as CredentialPluginId];
  }
  if (id in BUILTIN_CAPABILITIES) {
    return BUILTIN_CAPABILITIES[id as BuiltinPluginId] ?? null;
  }
  return null;
}
