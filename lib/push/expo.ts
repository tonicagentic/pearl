import { deleteDevicePushTokensByValues } from "@/lib/db/push";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, string>>;
  readonly sound?: "default" | null;
};

type ExpoTicket =
  | { readonly status: "ok"; readonly id: string }
  | {
      readonly status: "error";
      readonly message?: string;
      readonly details?: { readonly error?: string };
    };

/**
 * Send one or more Expo push messages. Drops DeviceNotRegistered tokens so
 * later deliveries do not keep targeting a revoked install.
 */
export async function sendExpoPush(
  messages: readonly ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json",
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Expo push failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    readonly data?: ExpoTicket | readonly ExpoTicket[];
  };

  const tickets = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : [];

  const staleTokens: string[] = [];
  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    const message = messages[index];
    if (
      ticket?.status === "error" &&
      ticket.details?.error === "DeviceNotRegistered" &&
      message
    ) {
      staleTokens.push(message.to);
    }
  }

  if (staleTokens.length > 0) {
    await deleteDevicePushTokensByValues(staleTokens);
  }
}
