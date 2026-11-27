/**
 * Map an eve authorization data part onto PermissionGrant props
 * (docs: elements/permission-grant), using Pearl's connection catalog for
 * friendly labels and reach copy instead of raw connector ids.
 */

import type { ConnectionId } from "../connections/catalog.ts";
import { CONNECTION_IDS } from "../connections/catalog.ts";
import {
  ACCOUNT_PLUGINS,
  TONIC_PLUGINS,
  type PluginMarkId,
} from "../plugins/catalog.ts";

export type AuthorizationGrantInput = {
  readonly state: "required" | "completed";
  readonly name: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly outcome?: string;
};

export type AuthorizationGrantView = {
  readonly capability: string;
  readonly requester: string;
  readonly reach: readonly string[];
  readonly scope: "pending" | "session" | "always" | "denied";
  /** Catalog mark for PluginLogo when we recognize the connection. */
  readonly markId?: PluginMarkId;
  readonly connectionId?: ConnectionId;
};

const CONNECTABLE = [...ACCOUNT_PLUGINS, ...TONIC_PLUGINS];

/** Loose matchers from Vercel Connect / MCP connector names → ConnectionId. */
const NAME_HINTS: readonly {
  readonly id: ConnectionId;
  readonly test: RegExp;
}[] = [
  { id: "github", test: /github|git__gh|copilot\.com/i },
  { id: "vercel", test: /vercel/i },
  { id: "gmail", test: /gmail|google.?mail/i },
  { id: "calendar", test: /calendar|google.?calendar/i },
  { id: "drive", test: /drive|google.?drive/i },
  { id: "expo", test: /\bexpo\b|eas\.build/i },
  { id: "neon", test: /\bneon\b/i },
  { id: "betterstack", test: /better.?stack/i },
  { id: "tempo", test: /\btempo\b/i },
  { id: "xero", test: /\bxero\b/i },
  { id: "sheets", test: /sheets|google.?sheets/i },
];

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split("\n")[0]?.trim();
  return line || undefined;
}

function looksLikeConnectorId(value: string): boolean {
  return (
    /__/.test(value) ||
    /\.(com|io|dev|app)_/i.test(value) ||
    /^[a-z0-9]+__[a-z0-9]/i.test(value)
  );
}

/** Infer a Pearl connection id from authorization name / display fields. */
export function resolveAuthorizationConnectionId(
  data: Pick<AuthorizationGrantInput, "name" | "displayName" | "description">,
): ConnectionId | undefined {
  const candidates = [data.displayName, data.name, data.description]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const raw of candidates) {
    const lowered = raw.toLowerCase();
    if ((CONNECTION_IDS as readonly string[]).includes(lowered)) {
      return lowered as ConnectionId;
    }
    // "pearl-github" / "GitHub" style labels.
    const dashed = lowered.replace(/^pearl[-_]/, "");
    if ((CONNECTION_IDS as readonly string[]).includes(dashed)) {
      return dashed as ConnectionId;
    }
  }

  for (const raw of candidates) {
    for (const hint of NAME_HINTS) {
      if (hint.test.test(raw)) return hint.id;
    }
  }

  return undefined;
}

function catalogFor(connectionId: ConnectionId) {
  return CONNECTABLE.find((plugin) => plugin.connectionId === connectionId);
}

export function authorizationGrantView(
  data: AuthorizationGrantInput,
): AuthorizationGrantView {
  const connectionId = resolveAuthorizationConnectionId(data);
  const catalog = connectionId ? catalogFor(connectionId) : undefined;
  const display = data.displayName?.trim() || undefined;
  const friendlyLabel =
    catalog?.label ??
    (display && !looksLikeConnectorId(display) ? display : undefined) ??
    (connectionId
      ? connectionId.charAt(0).toUpperCase() + connectionId.slice(1)
      : undefined);

  const capability = friendlyLabel
    ? `Connect ${friendlyLabel}`
    : (firstLine(data.instructions) ?? "Authorization required");

  const reach: string[] = [];
  if (catalog?.detail) reach.push(catalog.detail);
  const description = firstLine(data.description);
  if (
    description &&
    !looksLikeConnectorId(description) &&
    description !== catalog?.detail &&
    description !== capability
  ) {
    reach.push(description);
  }
  if (reach.length === 0) {
    reach.push(
      friendlyLabel
        ? `Access to your ${friendlyLabel} account for Pearl`
        : "Access to this connection for Pearl",
    );
  }

  let scope: AuthorizationGrantView["scope"] = "pending";
  if (data.state === "completed") {
    scope = data.outcome === "authorized" ? "session" : "denied";
  }

  return {
    capability,
    requester: "Pearl",
    reach,
    scope,
    ...(catalog ? { markId: catalog.id } : {}),
    ...(connectionId ? { connectionId } : {}),
  };
}
