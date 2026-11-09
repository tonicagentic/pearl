import type { EveMessage, EveMessagePart, EveToolPart } from "eve/client";
import type { ThreadMessageLike } from "@assistant-ui/react-native";
import { isAttachmentMarker } from "./attachment-content";

type Part = Exclude<ThreadMessageLike["content"], string>[number];

type ConversationMessages = {
  readonly messages: readonly EveMessage[];
};

const safeUrl = (value?: string) => value && /^https:\/\//i.test(value) ? value : undefined;
// Sent photos come back as data URLs. https stays allowed; other data URLs do not.
const displayImageUrl = (value?: string) =>
  safeUrl(value) ??
  (value && /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)
    ? value
    : undefined);
const FILE_PLACEHOLDER_LINE = /^\[(?:file(?:: [^\]]*)?|image: [^\]]+)\]$/;
/** Drop eve's text stand-in for a file once the image itself is on the message. */
export function stripFilePlaceholders(text: string): string {
  return text
    .split("\n")
    .filter((line) => !FILE_PLACEHOLDER_LINE.test(line.trim()))
    .join("\n")
    .trim();
}
const argsObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : value === undefined ? {} : { value };
const argsText = (value: unknown) => {
  try { return JSON.stringify(value ?? {}) ?? "{}"; } catch { return "{}"; }
};

function toolApprovalFromInteraction(
  interaction: NonNullable<EveToolPart["interaction"]>,
): NonNullable<Extract<Part, { type: "tool-call" }>["approval"]> {
  const request = interaction.request;
  const options = request.options?.map((option) => ({
    id: option.id,
    kind: option.id === "approve" ? "allow-once" as const
      : option.id === "cancel" || option.id === "deny" ? "reject-once" as const
      : `_${option.id}`,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
  }));
  const settled = interaction.status === "settled";
  const approved =
    interaction.outcome === "accepted"
      ? true
      : interaction.outcome === "declined"
        ? false
        : undefined;
  return {
    id: interaction.interactionId,
    prompt: request.prompt,
    display:
      request.display === "confirmation"
        ? "decision"
        : request.display === "select"
          ? "select"
          : request.display === "text"
            ? "text"
            : request.kind === "approval"
              ? "decision"
              : request.options?.length
                ? "select"
                : "text",
    ...(request.allowFreeform || request.display === "text" ? { allowFreeform: true } : {}),
    ...(settled && approved !== undefined ? { approved } : {}),
    ...(interaction.reason ? { reason: interaction.reason } : {}),
    ...(options?.length ? { options } : {}),
  };
}

function convertToolPart(part: EveToolPart): Part {
  const toolCall = {
    type: "tool-call" as const,
    toolCallId: part.callId,
    toolName: part.name,
    args: part.state === "streaming" ? {} : argsObject(part.input),
    argsText:
      part.state === "streaming" ? part.inputText : argsText(part.input),
    ...(part.interaction
      ? { approval: toolApprovalFromInteraction(part.interaction) }
      : {}),
  };
  switch (part.state) {
    case "completed":
      return { ...toolCall, result: part.output } as Part;
    case "failed":
    case "rejected":
    case "cancelled":
      return {
        ...toolCall,
        result: {
          error:
            part.error?.message ??
            part.interaction?.reason ??
            (part.state === "rejected"
              ? "Tool approval denied"
              : part.state === "cancelled"
                ? "Tool call cancelled"
                : "Tool call failed"),
        },
        isError: true,
      } as Part;
    default:
      return (
        part.output === undefined
          ? toolCall
          : { ...toolCall, result: part.output, isPreliminary: true }
      ) as Part;
  }
}

function assistantPart(part: EveMessagePart): Part | null {
  switch (part.type) {
    case "text":
    case "reasoning":
      return {
        type: part.type, text: typeof part.text === "string" ? part.text : "",
        ...(part.state === "done" ? { status: { type: "complete" as const } } : {}),
      };
    case "tool":
      return convertToolPart(part);
    case "interaction": {
      if (part.request.kind === "sign-in") {
        const signIn = part.request.signIn;
        const url = safeUrl(signIn?.url);
        return {
          type: "data",
          name: "authorization",
          data: {
            state: part.status === "open" ? "required" : "completed",
            name: signIn?.name ?? part.request.title ?? "sign-in",
            ...(signIn?.displayName ? { displayName: signIn.displayName } : {}),
            description: part.request.prompt,
            ...(signIn?.instructions ? { instructions: signIn.instructions } : {}),
            ...(signIn?.userCode ? { userCode: signIn.userCode } : {}),
            ...(url ? { url } : {}),
            ...(part.status === "settled"
              ? {
                  outcome:
                    part.outcome === "accepted"
                      ? "authorized"
                      : part.outcome === "declined" || part.outcome === "invalid"
                        ? "declined"
                        : part.outcome === "expired"
                          ? "timed-out"
                          : part.outcome === "failed"
                            ? "failed"
                            : "cancelled",
                  reason: part.reason,
                }
              : {}),
          },
        };
      }
      return {
        type: "tool-call",
        toolCallId: part.interactionId,
        toolName: part.call?.name ?? part.request.kind,
        args: argsObject(part.call?.input),
        argsText: argsText(part.call?.input),
        approval: toolApprovalFromInteraction(part),
        ...(part.status === "settled"
          ? {
              result: part.answer ?? { outcome: part.outcome, reason: part.reason },
              ...(part.outcome !== "accepted" ? { isError: true } : {}),
            }
          : {}),
      } as Part;
    }
    case "file": {
      const url = displayImageUrl(part.url);
      if (url && part.mediaType.startsWith("image/")) {
        return { type: "image", image: url, ...(part.filename ? { filename: part.filename } : {}) };
      }
      return {
        type: "file", data: url ?? "unavailable", sourceType: url ? "url" : "id",
        mimeType: part.mediaType, filename: part.filename,
      };
    }
    default:
      return null;
  }
}

// eve sends background-task notifications to the model as user messages.
// The assistant's follow-up, not this internal event, belongs in the thread.
const TASK_NOTIFICATION_PATTERN =
  /^Background task task_[a-z0-9]+( \([^)]*\))?( is completed| failed| is cancelled| needs input| update:| needs authorization)?/i;
export const isTaskNotification = (text: string) => TASK_NOTIFICATION_PATTERN.test(text);

// Persist a short label for a first send, never an internal correlation token or
// the pasted document body. This label is also used as the initial chat title.
export function pendingMessageLabel(content: string | readonly { type: string; text?: string }[] | undefined): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  const text = content.find((part) => part.type === "text" && typeof part.text === "string" &&
    !isAttachmentMarker(part.text) && !part.text.startsWith("[Pasted text]\n") &&
    !part.text.startsWith("[Attached PDF:") && !part.text.startsWith("[Attached text file:"));
  if (text?.text) return text.text;
  if (content.some((part) => part.type === "text" && part.text?.startsWith("[Pasted text]\n"))) return "Pasted text";
  return content.length > 0 ? "[Attachment]" : "";
}

function openInteractions(message: EveMessage) {
  return message.parts.flatMap((part) =>
    part.type === "interaction"
      ? [part]
      : part.type === "tool" && part.interaction
        ? [part.interaction]
        : [],
  );
}

function hasOpenApproval(message: EveMessage): boolean {
  return openInteractions(message).some(
    (interaction) =>
      interaction.status === "open" && interaction.request.kind !== "sign-in",
  );
}

function hasOpenAuthorization(message: EveMessage): boolean {
  return openInteractions(message).some(
    (interaction) =>
      interaction.status === "open" && interaction.request.kind === "sign-in",
  );
}

/** True when the latest assistant turn is parked on approval or authorization.
 * Approvals survive turn settlement (metadata.status becomes "complete"); failed
 * turns never block the next send. */
export function hasPendingAction(data: ConversationMessages): boolean {
  const message = data.messages.at(-1);
  if (message?.role !== "assistant") return false;
  if (message.metadata?.status === "failed") return false;
  return hasOpenApproval(message) || hasOpenAuthorization(message);
}

export type PendingApproval = {
  readonly requestId: string;
  readonly toolName: string;
  readonly prompt: string;
  readonly detail?: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
};

/** Open tool-approval parks on the latest assistant turn, for the composer card. */
export function getPendingApprovals(data: ConversationMessages): readonly PendingApproval[] {
  const message = data.messages.at(-1);
  if (message?.role !== "assistant") return [];
  if (message.metadata?.status === "failed") return [];

  return message.parts.flatMap((part) => {
    const interaction =
      part.type === "tool" && part.interaction?.status === "open"
        ? part.interaction
        : part.type === "interaction" &&
            part.status === "open" &&
            part.request.kind !== "sign-in"
          ? part
          : null;
    if (!interaction) return [];
    const request = interaction.request;
    const options = (request.options?.length
      ? request.options
      : [
          { id: "approve", label: "Approve" },
          { id: "cancel", label: "Cancel" },
        ]
    ).map((option) => ({ id: option.id, label: option.label }));
    const toolInput =
      part.type === "tool" && part.state !== "streaming" ? part.input : undefined;
    const interactionInput =
      part.type === "interaction" ? part.call?.input : undefined;
    const rawInput = toolInput ?? interactionInput;
    const input =
      rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
        ? (rawInput as Record<string, unknown>)
        : null;
    const summary =
      typeof input?.summary === "string"
        ? input.summary
        : typeof input?.filePath === "string"
          ? input.filePath
          : undefined;
    const toolName =
      part.type === "tool"
        ? part.name
        : part.type === "interaction"
          ? part.call?.name ?? request.kind
          : request.kind;
    return [
      {
        requestId: interaction.interactionId,
        toolName,
        prompt: request.prompt ?? `Approve tool call: ${toolName}`,
        ...(summary ? { detail: summary } : {}),
        options,
      },
    ];
  });
}

// Omit the message id: eve replaces the optimistic user id on acceptance, and
// this external-store runtime would otherwise retain an extra sibling branch.
export function toThreadMessages(
  state: ConversationMessages,
  { isRunning = false, hasError = false }: { isRunning?: boolean; hasError?: boolean } = {},
): ThreadMessageLike[] {
  return state.messages.map((message, index) => {
    if (message.role === "assistant") {
      const last = index === state.messages.length - 1;
      const pendingApproval =
        last &&
        !hasError &&
        message.metadata?.status !== "failed" &&
        hasOpenApproval(message);
      const pendingAuth =
        last &&
        !hasError &&
        message.metadata?.status !== "failed" &&
        hasOpenAuthorization(message);
      // Only surface a live failure for the active turn. Stale store.error or
      // historical metadata.status === "failed" on ended sessions must not
      // paint "An error occurred" into old transcripts.
      const liveFailure =
        last &&
        (isRunning || message.metadata?.status === "streaming") &&
        (hasError || message.metadata?.status === "failed");
      const status: NonNullable<ThreadMessageLike["status"]> = pendingApproval
        ? { type: "requires-action", reason: "tool-calls" }
        : pendingAuth ? { type: "requires-action", reason: "interrupt" }
        : liveFailure
          ? { type: "incomplete", reason: "error" }
          : isRunning && last ? { type: "running" }
          : message.metadata?.status === "streaming" ? { type: "incomplete", reason: "cancelled" }
          : { type: "complete", reason: "stop" };
      return {
        role: "assistant", status,
        content: message.parts.map(assistantPart).filter((p): p is Part => p !== null),
        metadata: { custom: { turnId: message.metadata?.turnId } },
      };
    }
    const documentParts = message.parts.filter((part): part is Extract<EveMessagePart, { type: "text" }> =>
      part.type === "text" && typeof part.text === "string" &&
      (part.text.startsWith("[Attached PDF: ") || part.text.startsWith("[Attached text file: ") ||
        part.text.startsWith("[Pasted text]\n")),
    );
    const attachments = message.parts.filter((part): part is Extract<EveMessagePart, { type: "file" }> => part.type === "file")
      .map((part, fileIndex) => {
        const image = part.mediaType.startsWith("image/") ? displayImageUrl(part.url) : undefined;
        return {
          id: `${message.id}:file:${fileIndex}`,
          type: (part.mediaType.startsWith("image/") ? "image" : "document") as "image" | "document",
          name: part.filename ?? "Attachment", contentType: part.mediaType,
          status: { type: "complete" as const },
          content: image ? [{ type: "image" as const, image }] : [],
        };
      }).concat(documentParts.map((part, fileIndex) => ({
        id: `${message.id}:document:${fileIndex}`,
        type: "document" as const,
        name: part.text.startsWith("[Pasted text]\n")
          ? `Pasted text · ${(part.text.length - "[Pasted text]\n".length).toLocaleString("en-US")} characters`
          : part.text.startsWith("[Attached PDF: ")
            ? part.text.slice("[Attached PDF: ".length).split(" — ")[0]
            : part.text.slice("[Attached text file: ".length).split("]")[0],
        contentType: part.text.startsWith("[Attached PDF: ") ? "application/pdf" : "text/plain",
        status: { type: "complete" as const }, content: [],
      })));
    const hasImage = attachments.some((attachment) => attachment.type === "image" && attachment.content.length > 0);
    return {
      role: "user",
      content: message.parts.filter((part): part is Extract<EveMessagePart, { type: "text" }> =>
        part.type === "text" && typeof part.text === "string" &&
        !documentParts.includes(part) && !isAttachmentMarker(part.text),
      ).flatMap((part) => {
        const text = hasImage ? stripFilePlaceholders(part.text) : part.text;
        return text ? [{ type: "text" as const, text }] : [];
      }),
      ...(attachments.length ? { attachments } : {}),
    };
  });
}
