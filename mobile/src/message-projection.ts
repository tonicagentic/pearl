import type { EveMessageData, EveMessagePart } from "eve/client";
import type { ThreadMessageLike } from "@assistant-ui/react-native";
import { isAttachmentMarker } from "./attachment-content";

type Part = Exclude<ThreadMessageLike["content"], string>[number];

const safeUrl = (value?: string) => value && /^https:\/\//i.test(value) ? value : undefined;
const argsObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : value === undefined ? {} : { value };
const argsText = (value: unknown) => {
  try { return JSON.stringify(value ?? {}) ?? "{}"; } catch { return "{}"; }
};

function assistantPart(part: EveMessagePart): Part | null {
  switch (part.type) {
    case "text":
    case "reasoning":
      return {
        type: part.type, text: typeof part.text === "string" ? part.text : "",
        ...(part.state === "done" ? { status: { type: "complete" as const } } : {}),
      };
    case "dynamic-tool": {
      const request = part.toolMetadata?.eve?.inputRequest;
      const approval = part.approval;
      const options = request?.options?.map((option) => ({
        id: option.id,
        kind: option.id === "approve" ? "allow-once" as const
          : option.id === "cancel" ? "reject-once" as const : `_${option.id}`,
        label: option.label,
        ...(option.description ? { description: option.description } : {}),
      }));
      return {
        type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName,
        args: argsObject(part.input),
        argsText: part.state === "input-streaming" ? part.inputText : argsText(part.input),
        ...(approval ? { approval: {
          id: approval.id,
          ...(approval.approved !== undefined ? { approved: approval.approved } : {}),
          ...(approval.reason ? { reason: approval.reason } : {}),
          ...(request ? {
            prompt: request.prompt,
            display: request.display ?? "confirmation",
            ...(request.allowFreeform ? { allowFreeform: true } : {}),
            ...(options?.length ? { options } : {}),
          } : {}),
        } } : {}),
        ...(part.state === "output-available" ? {
          result: part.output, ...(part.partial ? { isPreliminary: true } : {}),
        } : {}),
        ...(part.state === "output-error" || part.state === "output-denied" ? {
          result: { error: part.state === "output-error" ? part.errorText : part.approval.reason ?? "Tool approval denied" },
          isError: true,
        } : {}),
      } as Part;
    }
    case "authorization": {
      const url = safeUrl(part.authorization?.url);
      return { type: "data", name: "authorization", data: {
        state: part.state, name: part.name, displayName: part.displayName,
        description: part.description,
        ...(part.authorization?.instructions ? { instructions: part.authorization.instructions } : {}),
        ...(part.authorization?.userCode ? { userCode: part.authorization.userCode } : {}),
        ...(url ? { url } : {}),
        ...(part.state === "completed" ? { outcome: part.outcome, reason: part.reason } : {}),
      } };
    }
    case "file": {
      const url = safeUrl(part.url);
      if (url && part.mediaType.startsWith("image/")) {
        return { type: "image", image: url, ...(part.filename ? { filename: part.filename } : {}) };
      }
      return {
        type: "file", data: url ?? "unavailable", sourceType: url ? "url" : "id",
        mimeType: part.mediaType, filename: part.filename,
      };
    }
    case "step-start": return null;
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

export function hasPendingAction(data: EveMessageData): boolean {
  const message = data.messages.at(-1);
  return message?.role === "assistant" && message.metadata?.status === "streaming" &&
    message.parts.some((part) =>
      (part.type === "authorization" && part.state === "required") ||
      (part.type === "dynamic-tool" && part.state === "approval-requested"),
    );
}

// Omit the message id: eve replaces the optimistic user id on acceptance, and
// this external-store runtime would otherwise retain an extra sibling branch.
export function toThreadMessages(
  state: EveMessageData,
  { isRunning = false, hasError = false }: { isRunning?: boolean; hasError?: boolean } = {},
): ThreadMessageLike[] {
  return state.messages.map((message, index) => {
    if (message.role === "assistant") {
      const last = index === state.messages.length - 1;
      const active = last && message.metadata?.status === "streaming" && !hasError;
      const pendingApproval = active && message.parts.some((p) => p.type === "dynamic-tool" && p.state === "approval-requested");
      const pendingAuth = active && message.parts.some((p) => p.type === "authorization" && p.state === "required");
      const status: NonNullable<ThreadMessageLike["status"]> = pendingApproval
        ? { type: "requires-action", reason: "tool-calls" }
        : pendingAuth ? { type: "requires-action", reason: "interrupt" }
        : message.metadata?.status === "failed" || (hasError && last)
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
      .map((part, fileIndex) => ({
        id: `${message.id}:file:${fileIndex}`,
        type: (part.mediaType.startsWith("image/") ? "image" : "document") as "image" | "document",
        name: part.filename ?? "Attachment", contentType: part.mediaType,
        status: { type: "complete" as const },
        content: safeUrl(part.url) && part.mediaType.startsWith("image/")
          ? [{ type: "image" as const, image: part.url! }] : [],
      })).concat(documentParts.map((part, fileIndex) => ({
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
    return {
      role: "user",
      content: message.parts.filter((part): part is Extract<EveMessagePart, { type: "text" }> =>
        part.type === "text" && typeof part.text === "string" &&
        !documentParts.includes(part) && !isAttachmentMarker(part.text),
      ).map((part) => ({ type: "text" as const, text: part.text })),
      ...(attachments.length ? { attachments } : {}),
    };
  });
}
