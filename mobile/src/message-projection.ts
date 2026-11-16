import type {
  ConversationAgentSession,
  EveMessage,
  EveMessagePart,
  EveToolPart,
} from "eve/client";
import type { ThreadMessageLike } from "@assistant-ui/react-native";
import {
  isLiveHistoryId,
  type SpokenTurn,
} from "../../lib/chat/spoken-turns";
import { buildApprovalBrief } from "../../lib/chat/approval-brief";
import { isAttachmentMarker } from "./attachment-content";

type Part = Exclude<ThreadMessageLike["content"], string>[number];

type ConversationMessages = {
  readonly messages: readonly EveMessage[];
  /** Followed child sessions from SessionStore (`followAgents`). */
  readonly agents?: Readonly<Record<string, ConversationAgentSession>>;
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

type OpenInteraction = NonNullable<EveToolPart["interaction"]>;

type OpenPartHit = {
  readonly interaction: OpenInteraction;
  readonly part: EveMessagePart;
};

function openInteractions(message: EveMessage): readonly OpenInteraction[] {
  return openPartHits(message).map((hit) => hit.interaction);
}

function openPartHits(message: EveMessage): readonly OpenPartHit[] {
  if (message.role !== "assistant") return [];
  if (message.metadata?.status === "failed") return [];
  const hits: OpenPartHit[] = [];
  for (const part of message.parts) {
    if (part.type === "interaction" && part.status === "open") {
      // EveInteractionPart extends Interaction with `type`; strip the discriminant.
      const { type: _type, ...interaction } = part;
      hits.push({ interaction, part });
      continue;
    }
    if (part.type === "tool" && part.interaction?.status === "open") {
      hits.push({ interaction: part.interaction, part });
    }
  }
  return hits;
}

function hasOpenApproval(message: EveMessage): boolean {
  return openInteractions(message).some(
    (interaction) => interaction.request.kind !== "sign-in",
  );
}

function hasOpenAuthorization(message: EveMessage): boolean {
  return openInteractions(message).some(
    (interaction) => interaction.request.kind === "sign-in",
  );
}

/** Assistant messages newest-first, then followed child conversations. */
function conversationMessageSources(
  data: ConversationMessages,
): readonly EveMessage[][] {
  const sources: EveMessage[][] = [];
  if (data.messages.length > 0) {
    sources.push([...data.messages].reverse());
  }
  if (!data.agents) return sources;
  for (const agent of Object.values(data.agents)) {
    if (agent.observation.status === "not-followed") continue;
    const childMessages = agent.observation.conversation.messages;
    if (childMessages.length === 0) continue;
    sources.push([...childMessages].reverse());
  }
  return sources;
}

/**
 * True when any assistant turn (including followed subagents) is parked on
 * approval, question, or authorization. Continues to block after the parent
 * turn settles; failed turns never block the next send.
 */
export function hasPendingAction(data: ConversationMessages): boolean {
  for (const messages of conversationMessageSources(data)) {
    for (const message of messages) {
      if (hasOpenApproval(message) || hasOpenAuthorization(message)) {
        return true;
      }
    }
  }
  return false;
}

/** Label for the bottom status while a person-wait owns the composer. */
export type PendingWaitKind = "approval" | "question" | "authorization";

export function pendingWaitKind(
  data: ConversationMessages,
): PendingWaitKind | null {
  const approvals = getPendingApprovals(data);
  // Choice questions only — text-only freeform answers in the normal composer.
  if (approvals.some(isChoicePendingQuestion)) return "question";
  if (approvals.some((item) => item.kind === "approval")) return "approval";
  for (const messages of conversationMessageSources(data)) {
    for (const message of messages) {
      if (hasOpenAuthorization(message)) return "authorization";
    }
  }
  return null;
}

export function pendingWaitLabel(kind: PendingWaitKind): string {
  switch (kind) {
    case "question":
      return "Asking questions";
    case "authorization":
      return "Sign in to continue";
    case "approval":
      return "Needs your approval";
  }
}

export type PendingInteractionKind = "approval" | "question";

export type PendingApproval = {
  readonly requestId: string;
  readonly toolName: string;
  readonly kind: PendingInteractionKind;
  /** How the composer should present the request. */
  readonly display: "decision" | "select" | "text";
  readonly prompt: string;
  readonly detail?: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  /** True when the user may type a free-form answer (questions). */
  readonly allowFreeform: boolean;
  /**
   * True when Skip may settle this question (request flag or a cancel-like
   * option). Multi-question Skip can still navigate without this.
   */
  readonly dismissible?: boolean;
  /** Option id to send when Skip dismisses (cancel / skip / deny / dismiss). */
  readonly skipOptionId?: string;
};

const SKIP_OPTION_KEYS = new Set(["skip", "cancel", "deny", "dismiss"]);

/** Choice / select question — belongs in the composer Questions card. */
export function isChoicePendingQuestion(pending: PendingApproval): boolean {
  return pending.kind === "question" && pending.options.length > 0;
}

/** Text-only ask — stays in the thread; answer via the normal composer. */
export function isTextOnlyPendingQuestion(pending: PendingApproval): boolean {
  return pending.kind === "question" && pending.options.length === 0;
}

/**
 * Parks that should morph the composer. Text-only questions are omitted unless
 * they ride along in a multi-ask stack that already has a choice question.
 */
export function composerWaitingQuestions(
  pending: readonly PendingApproval[],
): readonly PendingApproval[] {
  const questions = pending.filter((item) => item.kind === "question");
  if (!questions.some(isChoicePendingQuestion)) return [];
  return questions.slice(0, 3);
}

/** Prefer an explicit cancel-like option for Skip dismiss. */
export function pendingSkipOptionId(
  options: readonly { readonly id: string; readonly label: string }[],
): string | undefined {
  const match = options.find((option) => {
    const id = option.id.trim().toLowerCase();
    const label = option.label.trim().toLowerCase();
    return SKIP_OPTION_KEYS.has(id) || SKIP_OPTION_KEYS.has(label);
  });
  return match?.id;
}

function requestDismissible(request: {
  readonly dismissible?: boolean;
}): boolean {
  return request.dismissible === true;
}

function pendingDisplay(
  request: {
    readonly kind: string;
    readonly display?: string;
    readonly options?: readonly unknown[];
    readonly allowFreeform?: boolean;
  },
): PendingApproval["display"] {
  if (request.display === "confirmation") return "decision";
  if (request.display === "select") return "select";
  if (request.display === "text") return "text";
  if (request.kind === "approval") return "decision";
  if (request.options && request.options.length > 0) return "select";
  return "text";
}

function pendingFromHit(hit: OpenPartHit): PendingApproval | null {
  const { interaction, part } = hit;
  const request = interaction.request;
  if (request.kind === "sign-in") return null;

  const kind: PendingInteractionKind =
    request.kind === "question" ? "question" : "approval";
  const display = pendingDisplay(request);
  const allowFreeform =
    kind === "question" &&
    (request.allowFreeform === true ||
      display === "text" ||
      !request.options?.length);

  // Approvals without declared options get Approve/Cancel. Questions keep
  // only their real options (or none, for free-text).
  const options = (
    request.options?.length
      ? request.options
      : kind === "approval"
        ? [
            { id: "approve", label: "Approve" },
            { id: "cancel", label: "Cancel" },
          ]
        : []
  ).map((option) => ({ id: option.id, label: option.label }));

  // Prefer the parked call on the interaction — when a coder (or other
  // parent) relays a child wait, part.name/input are the parent tool.
  const askedCall = interaction.call ?? (part.type === "interaction" ? part.call : undefined);
  const toolName =
    askedCall?.name ??
    (part.type === "tool"
      ? part.name
      : part.type === "interaction"
        ? part.call?.name ?? request.kind
        : request.kind);
  const rawInput =
    askedCall?.input ??
    (part.type === "tool" && part.state !== "streaming"
      ? part.input
      : undefined) ??
    (part.type === "interaction" ? part.call?.input : undefined);
  const input =
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : null;

  const defaultPrompt =
    kind === "question"
      ? "Answer the question to continue."
      : `Approve tool call: ${toolName}`;
  const skipOptionId =
    kind === "question" ? pendingSkipOptionId(options) : undefined;
  const dismissible =
    kind === "question" &&
    (requestDismissible(request as { readonly dismissible?: boolean }) ||
      skipOptionId != null);

  if (kind === "approval") {
    const brief = buildApprovalBrief({
      toolName,
      prompt: request.prompt ?? defaultPrompt,
      input,
    });
    // Custom one-line prompts skip arg fields in the brief; still surface a
    // short summary/path/statement under the Approve / Deny buttons.
    const detail =
      brief.detail ??
      (typeof input?.summary === "string"
        ? input.summary
        : typeof input?.filePath === "string"
          ? input.filePath
          : typeof input?.statement === "string"
            ? input.statement
            : undefined);
    return {
      requestId: interaction.interactionId,
      toolName,
      kind,
      display,
      prompt: brief.headline,
      ...(detail ? { detail } : {}),
      options,
      allowFreeform,
      ...(dismissible ? { dismissible: true } : {}),
      ...(skipOptionId ? { skipOptionId } : {}),
    };
  }

  const summary =
    typeof input?.summary === "string"
      ? input.summary
      : typeof input?.filePath === "string"
        ? input.filePath
        : typeof input?.statement === "string"
          ? input.statement
          : undefined;
  return {
    requestId: interaction.interactionId,
    toolName,
    kind,
    display,
    prompt: request.prompt ?? defaultPrompt,
    ...(summary ? { detail: summary } : {}),
    options,
    allowFreeform,
    ...(dismissible ? { dismissible: true } : {}),
    ...(skipOptionId ? { skipOptionId } : {}),
  };
}

/**
 * Open approval / question parks across the parent thread and followed
 * subagents. Newest messages win; interaction ids are deduped so a child
 * relay of the same wait does not double-card the composer.
 */
export function getPendingApprovals(
  data: ConversationMessages,
): readonly PendingApproval[] {
  const seen = new Set<string>();
  const pending: PendingApproval[] = [];
  for (const messages of conversationMessageSources(data)) {
    for (const message of messages) {
      for (const hit of openPartHits(message)) {
        if (seen.has(hit.interaction.interactionId)) continue;
        const next = pendingFromHit(hit);
        if (!next) continue;
        seen.add(next.requestId);
        pending.push(next);
      }
    }
  }
  return pending;
}

/** Open person-wait belonging to a specific tool call (delegation or tool). */
export function pendingForToolCall(
  data: ConversationMessages,
  toolCallId: string,
): PendingApproval | null {
  for (const messages of conversationMessageSources(data)) {
    for (const message of messages) {
      for (const hit of openPartHits(message)) {
        if (hit.part.type === "tool" && hit.part.callId === toolCallId) {
          return pendingFromHit(hit);
        }
        if (
          hit.part.type === "interaction" &&
          (hit.part.call?.callId === toolCallId ||
            hit.interaction.call?.callId === toolCallId)
        ) {
          return pendingFromHit(hit);
        }
      }
    }
  }
  return null;
}

/**
 * Open wait for a delegation: the tool part itself, or a followed child
 * conversation owned by that call.
 */
export function pendingForDelegation(
  data: ConversationMessages,
  toolCallId: string | undefined,
): PendingApproval | null {
  if (!toolCallId) return null;
  const direct = pendingForToolCall(data, toolCallId);
  if (direct) return direct;
  if (!data.agents) return null;
  for (const agent of Object.values(data.agents)) {
    const ownsCall =
      agent.callId === toolCallId ||
      ("callId" in agent.owner && agent.owner.callId === toolCallId);
    if (!ownsCall) continue;
    if (agent.observation.status === "not-followed") continue;
    const childPending = getPendingApprovals({
      messages: agent.observation.conversation.messages,
    });
    if (childPending[0]) return childPending[0];
  }
  return null;
}

type ProjectionCacheEntry = {
  fingerprint: string;
  projected: ThreadMessageLike;
};

/** Reuse settled ThreadMessageLike refs across stream ticks so assistant-ui
 *  does not reconvert the entire history on every content.delta. */
const projectionCache = new Map<string, ProjectionCacheEntry>();

function messageFingerprint(
  message: EveMessage,
  {
    last,
    isRunning,
    hasError,
  }: { last: boolean; isRunning: boolean; hasError: boolean },
): string {
  let partsKey = "";
  for (const part of message.parts) {
    if (part.type === "text" || part.type === "reasoning") {
      partsKey += `${part.type}:${part.text.length};`;
    } else if (part.type === "tool") {
      partsKey += `tool:${part.callId}:${part.state}:${part.interaction?.status ?? ""};`;
    } else if (part.type === "file") {
      partsKey += `file:${part.url?.length ?? 0};`;
    } else if (part.type === "interaction") {
      partsKey += `interaction:${part.interactionId}:${part.status};`;
    } else {
      partsKey += `${(part as { type: string }).type};`;
    }
  }
  return [
    message.role,
    message.metadata?.status ?? "",
    message.metadata?.turnId ?? "",
    last ? "1" : "0",
    isRunning ? "1" : "0",
    hasError ? "1" : "0",
    partsKey,
  ].join("|");
}

function projectAssistantMessage(
  message: EveMessage,
  {
    last,
    isRunning,
    hasError,
  }: { last: boolean; isRunning: boolean; hasError: boolean },
): ThreadMessageLike {
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
  const live = isLiveHistoryId(message.metadata?.historyId);
  return {
    role: "assistant", status,
    content: message.parts.map(assistantPart).filter((p): p is Part => p !== null),
    metadata: {
      ...(live ? { modality: "voice" as const } : {}),
      custom: {
        turnId: message.metadata?.turnId,
        ...(message.metadata?.historyId
          ? { historyId: message.metadata.historyId }
          : {}),
      },
    },
  };
}

function projectUserMessage(message: EveMessage): ThreadMessageLike {
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
  const live = isLiveHistoryId(message.metadata?.historyId);
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
    ...(live
      ? {
          metadata: {
            modality: "voice" as const,
            custom: { historyId: message.metadata?.historyId },
          },
        }
      : {}),
  };
}

/** Spoken lines not yet present as imported eve messages. */
export function spokenTurnsPendingImport(
  spoken: readonly SpokenTurn[],
  messages: readonly EveMessage[],
): SpokenTurn[] {
  const imported = new Set(
    messages
      .map((message) => message.metadata?.historyId)
      .filter((id): id is string => typeof id === "string"),
  );
  return spoken.filter((turn) => !imported.has(turn.id));
}

/** Overlay live turns onto the thread until eve imports them. */
export function appendSpokenTurnMessages(
  projected: readonly ThreadMessageLike[],
  spoken: readonly SpokenTurn[],
): ThreadMessageLike[] {
  // Keep the projected array identity when there is nothing to overlay so
  // assistant-ui's external-store equality can skip a full thread resync.
  if (spoken.length === 0) return projected as ThreadMessageLike[];
  const overlay: ThreadMessageLike[] = spoken.map((turn) => ({
    role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: [{ type: "text" as const, text: turn.text }],
    metadata: {
      modality: "voice" as const,
      custom: { historyId: turn.id },
    },
  }));
  return [...projected, ...overlay];
}

// Omit the message id: eve replaces the optimistic user id on acceptance, and
// this external-store runtime would otherwise retain an extra sibling branch.
export function toThreadMessages(
  state: ConversationMessages,
  { isRunning = false, hasError = false }: { isRunning?: boolean; hasError?: boolean } = {},
): ThreadMessageLike[] {
  const seen = new Set<string>();
  const projected = state.messages.map((message, index) => {
    const last = index === state.messages.length - 1;
    const fingerprint = messageFingerprint(message, { last, isRunning, hasError });
    seen.add(message.id);
    const cached = projectionCache.get(message.id);
    if (cached && cached.fingerprint === fingerprint) return cached.projected;
    const next =
      message.role === "assistant"
        ? projectAssistantMessage(message, { last, isRunning, hasError })
        : projectUserMessage(message);
    projectionCache.set(message.id, { fingerprint, projected: next });
    return next;
  });
  for (const id of projectionCache.keys()) {
    if (!seen.has(id)) projectionCache.delete(id);
  }
  return projected;
}
