/**
 * User-facing capability copy for marketplace connectable plugins.
 * Aligned with agent connection allowlists; not a security boundary.
 */

import type { ConnectionId } from "../connections/catalog";
import type { AccountPluginId, TonicPluginId } from "./catalog";

export type PluginCapabilities = {
  readonly canDo: readonly string[];
  readonly needsApproval: readonly string[];
};

type MarketplaceConnectionId = AccountPluginId | TonicPluginId;

const CAPABILITIES: Record<MarketplaceConnectionId, PluginCapabilities> = {
  gmail: {
    canDo: [
      "Search and read threads and messages in your Gmail",
      "List labels and drafts",
      "Create email drafts in your account",
    ],
    needsApproval: [
      "Send mail (always asks before sending)",
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

/** Capabilities for a marketplace plugin / connection id. */
export function capabilitiesForConnection(
  id: ConnectionId | MarketplaceConnectionId,
): PluginCapabilities | null {
  if (id in CAPABILITIES) {
    return CAPABILITIES[id as MarketplaceConnectionId];
  }
  return null;
}
