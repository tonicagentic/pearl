import type { SendTurnPayload } from "eve/client";
import { expandHeldPastes } from "../../../lib/chat/large-paste";
import { buildTurnClientContext } from "../turn-client-context";

export type SendLimitResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly message: string;
      readonly retryAfter: number;
    };

export type PrepareSendDeps = {
  readonly checkSendLimit: (input?: {
    readonly message?: string;
  }) => Promise<SendLimitResult>;
  readonly projectId: string | null;
  readonly chatId: string | null;
  readonly customAgentId: string | null;
  /** When set, attach turnPolicy for send-while-busy. */
  readonly turnPolicy?: "steer" | "queue";
};

/**
 * Pearl prepareSend enrichment: rate limit, held-paste expand, clientContext.
 * Chat-row creation stays in chat-context; this only shapes the outbound turn.
 */
export async function enrichPrepareSendPayload(
  input: SendTurnPayload,
  deps: PrepareSendDeps,
): Promise<SendTurnPayload> {
  const messageText =
    typeof input.message === "string"
      ? input.message
      : Array.isArray(input.message)
        ? input.message
            .filter(
              (part): part is { type: "text"; text: string } =>
                part != null &&
                typeof part === "object" &&
                (part as { type?: string }).type === "text" &&
                typeof (part as { text?: unknown }).text === "string",
            )
            .map((part) => part.text)
            .join("\n")
        : "";

  const limit = await deps.checkSendLimit(
    messageText ? { message: messageText } : undefined,
  );
  if (!limit.allowed) {
    throw new Error(`${limit.message} Retry in ${limit.retryAfter}s.`);
  }

  const clientContext = {
    ...((input.clientContext as Record<string, string> | undefined) ?? {}),
    ...buildTurnClientContext(
      deps.projectId,
      deps.chatId,
      deps.customAgentId,
    ),
  };

  if (typeof input.message === "string") {
    const expanded = expandHeldPastes(input.message).text;
    return {
      ...input,
      message: expanded,
      clientContext,
      ...(deps.turnPolicy ? { turnPolicy: deps.turnPolicy } : {}),
    } as SendTurnPayload;
  }

  // Answers / non-string messages: attach context only (no turnPolicy).
  return {
    ...input,
    clientContext,
  } as SendTurnPayload;
}

/** Decide turnPolicy for an outbound send given open-turn + queue capability. */
export function resolveTurnPolicy(input: {
  readonly queueEnabled: boolean;
  readonly turnOpen: boolean;
}): "queue" | undefined {
  if (input.queueEnabled && input.turnOpen) return "queue";
  return undefined;
}
