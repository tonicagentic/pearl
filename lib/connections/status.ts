import {
  ConnectError,
  ConnectorInstallationRequiredError,
  getConnectorMetadata,
  getTokenResponse,
  NoValidTokenError,
  UserAuthorizationRequiredError,
  type ConnectTokenResponse,
} from "@vercel/connect";
import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
  type ConnectionId,
  type ConnectionStatus,
} from "./catalog";
import { connectionTokenParams } from "./oauth-scopes";

/** Recompute per-user grant state from Connect; UI state is never authority. */
export async function listConnectionStatuses(
  userId?: string,
): Promise<ConnectionStatus[]> {
  return Promise.all(
    CONNECTION_IDS.map((id) =>
      userId ? checkConnectionStatus(id, userId) : connectionStatus(id),
    ),
  );
}

export async function connectionStatus(
  id: ConnectionId,
): Promise<ConnectionStatus> {
  const config = connectionConfiguration(id);
  if (!config.connector) {
    return {
      id,
      label: config.label,
      status: "unavailable",
      detail: config.reason,
    };
  }
  try {
    // Connect verifies that the connector is attached to this project and
    // enabled for the active environment. It does not prove user consent.
    await getConnectorMetadata(config.connector);
    return {
      id,
      label: config.label,
      status: "available",
      detail:
        "Available to this app. Check your account's authorization separately.",
    };
  } catch (error) {
    if (
      error instanceof ConnectorInstallationRequiredError ||
      (error instanceof ConnectError &&
        (error.status === 403 || error.status === 404))
    ) {
      return {
        id,
        label: config.label,
        status: "unavailable",
        detail: "Connector is not attached to this project or environment.",
      };
    }
    return {
      id,
      label: config.label,
      status: "unknown",
      detail: "Could not verify connector setup right now.",
    };
  }
}

/** Explicit check: may resolve/refresh a token, but never returns it to clients. */
export async function checkConnectionStatus(
  id: ConnectionId,
  userId: string,
  forceRefresh = false,
): Promise<ConnectionStatus> {
  const available = await connectionStatus(id);
  if (available.status !== "available") return available;
  const connector = connectionConfiguration(id).connector;
  if (!connector) return available;
  try {
    // Match lib/eve-auth.ts's principal id and issuer exactly so a status
    // check cannot accidentally inspect another principal's grant.
    const token = await getTokenResponse(
      connector,
      {
        subject: connectionSubjectForUser(userId),
        ...connectionTokenParams(id),
      },
      { forceRefresh },
    );
    const accountLabel = accountLabelFromToken(token);
    return {
      id,
      label: available.label,
      status: "connected",
      accountLabel,
      detail: accountLabel
        ? `Connected as ${accountLabel}.`
        : `Connected to your ${available.label} account.`,
    };
  } catch (error) {
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      return {
        id,
        label: available.label,
        status: "not-connected",
        detail:
          "Not authorized for your account. You can connect here or authorize when Pearl needs it in chat.",
      };
    }
    if (error instanceof ConnectorInstallationRequiredError) {
      return {
        id,
        label: available.label,
        status: "unavailable",
        detail: "Connector installation is required.",
      };
    }
    return {
      id,
      label: available.label,
      status: "unknown",
      detail: "Could not verify your authorization right now.",
    };
  }
}

/**
 * Pick a safe display string from Connect metadata. Never returns tokens or
 * raw claim bags — only a short identity label for the Settings UI.
 */
export function accountLabelFromToken(
  token: Pick<
    ConnectTokenResponse,
    "name" | "externalSubject" | "claims" | "metadata"
  >,
): string | undefined {
  const fromName = cleanLabel(token.name);
  if (fromName) return fromName;

  const claims = isRecord(token.claims) ? token.claims : null;
  const metadata = isRecord(token.metadata) ? token.metadata : null;

  for (const source of [claims, metadata]) {
    if (!source) continue;
    for (const key of [
      "email",
      "preferred_username",
      "login",
      "username",
      "name",
      "user",
    ] as const) {
      const value = cleanLabel(source[key]);
      if (value) return value;
    }
  }

  return cleanLabel(token.externalSubject);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  // Reject anything that looks like a bearer/token id.
  if (/^(ya29\.|gh[pousr]_|stk_|sk_|Bearer\s)/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
