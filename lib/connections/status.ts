import {
  ConnectError,
  ConnectorInstallationRequiredError,
  getConnectorMetadata,
  getTokenResponse,
  NoValidTokenError,
  UserAuthorizationRequiredError,
} from "@vercel/connect";
import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
  type ConnectionId,
  type ConnectionStatus,
} from "./catalog";

/** Recompute per-user grant state from Connect; UI state is never authority. */
export async function listConnectionStatuses(userId?: string): Promise<ConnectionStatus[]> {
  return Promise.all(CONNECTION_IDS.map((id) =>
    userId ? checkConnectionStatus(id, userId) : connectionStatus(id),
  ));
}

export async function connectionStatus(id: ConnectionId): Promise<ConnectionStatus> {
  const config = connectionConfiguration(id);
  if (!config.connector) {
    return { id, label: config.label, status: "unavailable", detail: config.reason };
  }
  try {
    // Connect verifies that the connector is attached to this project and
    // enabled for the active environment. It does not prove user consent.
    await getConnectorMetadata(config.connector);
    return {
      id,
      label: config.label,
      status: "available",
      detail: "Available to this app. Check your account's authorization separately.",
    };
  } catch (error) {
    if (error instanceof ConnectorInstallationRequiredError ||
      (error instanceof ConnectError && (error.status === 403 || error.status === 404))) {
      return {
        id, label: config.label, status: "unavailable",
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
    await getTokenResponse(connector, {
      subject: connectionSubjectForUser(userId),
    }, { forceRefresh });
    return {
      id, label: available.label, status: "connected",
      detail: "Authorization is saved with Connect for your account. Tool access still depends on the provider.",
    };
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError || error instanceof NoValidTokenError) {
      return {
        id, label: available.label, status: "not-connected",
        detail: "Not authorized for your account. You can connect here or authorize when eve needs it in chat.",
      };
    }
    if (error instanceof ConnectorInstallationRequiredError) {
      return { id, label: available.label, status: "unavailable", detail: "Connector installation is required." };
    }
    return { id, label: available.label, status: "unknown", detail: "Could not verify your authorization right now." };
  }
}
