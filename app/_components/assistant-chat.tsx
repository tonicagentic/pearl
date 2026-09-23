"use client";

import {
  useEveAgentRuntime,
  useEveError,
  useEveSession,
} from "@assistant-ui/eve";
import { createChatMessageReducer } from "@/lib/chat/message-reducer";
import { cn } from "@/lib/utils";
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type AttachmentAdapter,
  type CompleteAttachment,
  type PendingAttachment,
} from "@assistant-ui/react";import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type {
  EveAgentStoreSnapshot,
  EveMessageData,
  ClientSessionState,
  MessageStreamEvent,
  PrepareSend,
} from "eve/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatShell } from "@/app/_components/chat-shell-context";
import { ErrorToast } from "@/app/_components/error-toast";
import { SessionStatusBanner } from "@/app/_components/session-status";
import { SubagentRunsProvider, TaskGroup } from "@/components/assistant-ui/elements/task-card.aui";
import { expandHeldPastes, setLargePasteErrorHandler } from "@/lib/chat/large-paste";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import {
  EditFileToolUI,
  ReadFileToolUI,
  WriteFileToolUI,
} from "@/components/assistant-ui/elements/file-tool.aui";
import {
  CanvasProvider,
  useCanvas,
} from "@/components/assistant-ui/elements/canvas-context";
import {
  CanvasSplitBody,
  CanvasSplitHeader,
  CanvasSplitLine,
} from "@/components/assistant-ui/elements/canvas-split";
import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";
import { EveAuthorization } from "@/components/eve-authorization";
import {
  appendClientChatEvents,
  checkClientSendLimit,
  createClientChat,
  saveClientChatSession,
  saveClientChatSnapshot,
} from "@/lib/chat/persistence-client";
import { createFallbackTitle } from "@/lib/chat/title";
import type { ActiveChat, StorageMode } from "@/lib/chat/types";

const EMPTY_EVENTS: readonly MessageStreamEvent[] = [];

// Stream-event persistence flush cadence in database mode: events buffer
// client-side and land in one batched server action per interval instead of
// one invocation per event (docs: checkpoint-optimization-plan.md).
const EVENT_FLUSH_INTERVAL_MS = 500;

// Screenshots and photos are downscaled before staging: a 3000px screenshot
// is ~3 MB while a 1600px JPEG is ~250 KB, and vision interpretation does not
// need the original resolution. Keeps several images per message under the
// server-action body limit and out of Postgres bloat.
const MAX_IMAGE_EDGE = 1600;
const DOWNSCALED_JPEG_QUALITY = 0.85;

async function readAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

// Raster images larger than MAX_IMAGE_EDGE are downscaled to a JPEG. Returns
// null when the image is small enough to stage as-is (or cannot be decoded —
// the caller then stages the original file).
async function downscaleForStaging(file: File): Promise<File | null> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);

    if (longestEdge <= MAX_IMAGE_EDGE && file.size < 512 * 1024) {
      bitmap.close();
      return null;
    }

    const scale = MAX_IMAGE_EDGE / longestEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", DOWNSCALED_JPEG_QUALITY),
    );

    if (!blob) return null;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

// Image adapter: downscales oversized images at stage time, then sends the
// staged file as an inline image part (the eve channel and the model both
// accept data-URL images; verified end to end).
class DownscalingImageAttachmentAdapter implements AttachmentAdapter {
  accept = "image/png,image/jpeg,image/webp";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    const staged = (await downscaleForStaging(file)) ?? file;

    return {
      id: crypto.randomUUID(),
      type: "image",
      name: staged.name,
      contentType: staged.type || "image/png",
      file: staged,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    return {
      id: attachment.id,
      type: "image",
      name: attachment.name,
      contentType: attachment.contentType ?? "image/png",
      content: [
        {
          type: "image",
          image: await readAsDataUrl(attachment.file),
        },
      ],
      status: { type: "complete" },
    };
  }

  async remove(): Promise<void> {}
}


// PDFs: the built-in Simple adapters cover images and text only. This minimal
// adapter stages a PDF as a data-URL file part, which the eve channel and the
// model both accept.
class PdfAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      contentType: file.type || "application/pdf",
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const label = attachment.name;
    const base = {
      id: attachment.id,
      type: "document" as const,
      name: attachment.name,
      contentType: "application/pdf" as const,
      status: { type: "complete" } as const,
    };

    // The deployed model rejects PDF file parts, so the composer uploads the
    // PDF to /api/attachments (Blob archive + pdf-inspector extraction) and
    // delivers the extracted text as the message content instead.
    try {
      const form = new FormData();
      form.append("file", attachment.file, attachment.name);

      const res = await fetch("/api/attachments", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | {
            attachmentId?: string;
            pages?: number | null;
            pdfType?: string | null;
            extractedText?: string | null;
            extractionNote?: string | null;
            error?: string;
          }
        | null;

      if (!res.ok || !data?.attachmentId) {
        throw new Error(data?.error ?? `Upload failed (${res.status}).`);
      }

      const attachmentId = data.attachmentId;
      const extractedText = data.extractedText ?? "";
      const pageCount = data.pages ?? null;
      const scanned =
        data.pdfType === "Scanned" || data.pdfType === "ImageBased";

      if (scanned) {
        return {
          ...base,
          content: [
            {
              type: "text",
              text: `[Attached PDF: ${label} (${pageCount ?? "?"} pages, attachment ${attachmentId}) — this PDF is scanned/image-based with no extractable text layer, so read_attachment cannot serve its contents.]`,
            },
          ],
        };
      }

      // First page inline for immediate context; the agent reads the rest
      // with the paged read_attachment tool.
      const firstPageMatch = extractedText.match(
        /\[page 1\]\n([\s\S]*?)(?:\n\n\[page 2\]|$)/,
      );
      const firstPage = firstPageMatch?.[1]?.trim() ?? "";

      return {
        ...base,
        content: [
          {
            type: "text",
            text: `[Attached PDF: ${label} — ${pageCount ?? "?"} pages, stored as attachment ${attachmentId}. Read any page with read_attachment({ attachmentId: "${attachmentId}", page: N }). Page 1:\n\n${firstPage}]`,
          },
        ],
      };
    } catch (error) {
      return {
        ...base,
        content: [
          {
            type: "text",
            text: `[Attached PDF: ${label} could not be processed.${
              error instanceof Error ? ` ${error.message}` : ""
            }]`,
          },
        ],
      };
    }
  }

  async remove(): Promise<void> {}
}

type AssistantChatSurfaceProps = {
  /**
   * Real chat id once the chat row exists, or null for a brand-new chat
   * (the row is created in prepareSend before the first turn).
   */
  readonly chatId: string | null;
  /** Loaded chat used to seed the runtime. Callers must remount (key) when it loads. */
  readonly activeChat: ActiveChat | null;
  readonly pendingUserMessage?: string | null;
  readonly onChatCreated?: (chatId: string) => void;
  readonly onPendingUserMessageSettled?: (message?: string) => void;
  readonly onActiveChatUpdated?: (chat: ActiveChat) => void;
};

export function AssistantChatSurface({
  chatId,
  activeChat,
  pendingUserMessage = null,
  onChatCreated,
  onPendingUserMessageSettled,
  onActiveChatUpdated,
}: AssistantChatSurfaceProps) {
  const { requestSignIn, setActiveChatId, setupStatus, touchChat, viewer } =
    useChatShell();
  const storageMode = setupStatus.storageMode;
  const [clientError, setClientError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const activeChatIdRef = useRef<string | null>(chatId);
  const eventIndexRef = useRef(activeChat?.events.length ?? 0);
  const savedEventCountRef = useRef(activeChat?.events.length ?? 0);
  const currentTitleRef = useRef(activeChat?.title ?? "New chat");
  const eventBufferRef = useRef<
    { event: MessageStreamEvent; eventIndex: number }[]
  >([]);
  const eventFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDisabled = !viewer || !setupStatus.appReady;

  const persistSessionChange = useCallback(
    (session: ClientSessionState | undefined) => {
      const id = activeChatIdRef.current;

      if (!id || !session) {
        return;
      }

      void saveClientChatSession(storageMode, { chatId: id, session }).catch(
        () => {},
      );
    },
    [storageMode],
  );

  const persistStreamEvent = useCallback(
    (event: MessageStreamEvent) => {
      const id = activeChatIdRef.current;

      if (!id) {
        return;
      }

      const eventIndex = eventIndexRef.current;
      eventIndexRef.current += 1;

      if (storageMode === "browser") {
        void appendClientChatEvents(storageMode, {
          chatId: id,
          events: [{ event, eventIndex }],
        }).catch((error) => {
          setClientError(
            error instanceof Error
              ? error.message
              : "Failed to save stream progress.",
          );
        });
        return;
      }

      // Database mode: buffer events and flush on a timer — one server action
      // per streamed event produced ~6 invocations/second in production logs
      // (docs: checkpoint-optimization-plan.md). A crash between flushes loses
      // at most the buffer; persistSnapshot still saves the full event set at
      // turn end.
      eventBufferRef.current.push({ event, eventIndex });

      if (eventFlushTimerRef.current !== null) {
        return;
      }

      eventFlushTimerRef.current = setTimeout(() => {
        eventFlushTimerRef.current = null;
        const batch = eventBufferRef.current;
        eventBufferRef.current = [];

        if (batch.length === 0) {
          return;
        }

        void appendClientChatEvents(storageMode, {
          chatId: id,
          events: batch,
        }).catch((error) => {
          setClientError(
            error instanceof Error
              ? error.message
              : "Failed to save stream progress.",
          );
        });
      }, EVENT_FLUSH_INTERVAL_MS);
    },
    [storageMode],
  );

  const persistSnapshot = useCallback(
    (snapshot: EveAgentStoreSnapshot<EveMessageData>) => {
      const id = activeChatIdRef.current;

      if (!id) {
        return;
      }

      void (async () => {
        try {
          const events = snapshot.events;
          const session = snapshot.session;

          // eve fires onFinish even when a mount/resume found nothing new.
          // Only treat the snapshot as an update when the event stream
          // actually changed, so idle opens do not reorder the sidebar.
          if (events.length === savedEventCountRef.current) {
            onPendingUserMessageSettled?.();
            return;
          }

          await saveClientChatSnapshot(storageMode, {
            chatId: id,
            events,
            session,
          });
          eventIndexRef.current = events.length;
          savedEventCountRef.current = events.length;
          touchChat({
            id,
            title: currentTitleRef.current,
            updatedAt: new Date().toISOString(),
          });
          onActiveChatUpdated?.({
            id,
            events,
            pendingUserMessage: null,
            session,
            title: currentTitleRef.current,
          });
          onPendingUserMessageSettled?.();
        } catch (error) {
          setClientError(
            error instanceof Error ? error.message : "Failed to save chat.",
          );
        }
      })();
    },
    [onActiveChatUpdated, onPendingUserMessageSettled, storageMode, touchChat],
  );

  const prepareSend = useCallback(
    async (input: Parameters<PrepareSend>[0]): Promise<Parameters<PrepareSend>[0]> => {
      if (!viewer) {
        requestSignIn();
        throw new Error("Sign in to send messages.");
      }

      const messageText =
        typeof input.message === "string" ? input.message : "";

      const limit = await checkClientSendLimit(storageMode, {
        message: messageText,
      });

      if (!limit.allowed) {
        throw new Error(`${limit.message} Retry in ${limit.retryAfter}s.`);
      }

      if (!activeChatIdRef.current) {
        const created = await createClientChat(storageMode, {
          pendingUserMessage: messageText,
        });
        activeChatIdRef.current = created.id;
        setActiveChatId(created.id);
        touchChat(created);
        onChatCreated?.(created.id);
      }

      if (messageText) {
        currentTitleRef.current = createFallbackTitle(messageText);
      }

      // Large pastes travel attachment-style: limits, title, and the pending
      // restore message see the composer text (held pastes are chips), while
      // the outgoing turn message carries the full inline blocks.
      if (typeof input.message === "string") {
        return { ...input, message: expandHeldPastes(input.message).text };
      }

      return input;
    },
    [
      onChatCreated,
      requestSignIn,
      setActiveChatId,
      storageMode,
      touchChat,
      viewer,
    ],
  );

  // eve's default reducer leaves a failed turn's assistant message with
  // metadata.status "streaming", which the message converter maps to
  // cancelled-with-empty-text: the failure renders as a blank bubble. Our
  // reducer marks turn.failed as status "failed" so the error-state banner
  // renders. useEveAgentRuntime's options type omits `reducer`, but it
  // forwards unknown options to useEveAgent, which accepts it — hence the
  // cast.
  const runtimeOptions = {
    adapters: {
      // Composer attachments: images and text via the built-in adapters, PDFs
      // via a minimal data-URL adapter. Media types match the eve channel's
      // upload policy (agent/channels/eve.ts).
      attachments: new CompositeAttachmentAdapter([
        // Downscaling first (png/jpeg/webp); SimpleImage stays as the
        // fallback for other image types (e.g. gif).
        new DownscalingImageAttachmentAdapter(),
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new PdfAttachmentAdapter(),
      ]),
    },
    resume: Boolean(activeChat?.session),
    initialEvents: activeChat?.events ?? EMPTY_EVENTS,
    initialSession: activeChat?.session,
    onEvent: persistStreamEvent,
    onFinish: persistSnapshot,
    // Persist the session cursor the moment eve returns it — waiting for the
    // settle snapshot leaves the chat row unlinked for the whole first turn,
    // which breaks features keyed on the eve session id (agent files).
    onSessionChange: persistSessionChange,
    prepareSend,
    isDisabled,
    reducer: createChatMessageReducer(),
  };
  const runtime = useEveAgentRuntime(
    runtimeOptions as Parameters<typeof useEveAgentRuntime>[0],
  );

  const thread = runtime.thread;
  useEffect(() => {
    const update = () => setIsRunning(thread.getState().isRunning);
    update();
    return thread.subscribe(update);
  }, [thread]);

  useEffect(() => {
    if (isDisabled || isRunning || !pendingUserMessage) {
      return;
    }

    onPendingUserMessageSettled?.(pendingUserMessage);
    thread.append(pendingUserMessage);
  }, [
    isDisabled,
    isRunning,
    onPendingUserMessageSettled,
    pendingUserMessage,
    thread,
  ]);

  const toastError =
    clientError !== null && dismissedError !== clientError ? clientError : null;

  // Paste-flow errors (size cap, chip cap) surface through the same toast.
  useEffect(() => {
    setLargePasteErrorHandler(setClientError);
  }, [setClientError]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CanvasProvider chatId={chatId}>
        <div className="flex min-h-0 flex-1 flex-col">
          {toastError ? (
            <ErrorToast
              message={toastError}
              onDismiss={() => setDismissedError(clientError)}
            />
          ) : null}

          <WriteFileToolUI />
          <EditFileToolUI />
          <ReadFileToolUI />
          <SessionStatusBanner isRunning={isRunning} />
          <CanvasLayout />

          <EveAuthorization />
        </div>

        <SessionCursorPersistence chatId={chatId} storageMode={storageMode} />
        <EveErrorToast />
      </CanvasProvider>
    </AssistantRuntimeProvider>
  );
}

// When an agent-written document is open, the thread narrows to a rail and
// the document takes the room (assistant-ui Canvas pattern). Otherwise the
// thread renders full width. Markdown files render formatted through the
// standalone markdown renderer; anything else stays raw monospace.
function isMarkdownPath(path: string): boolean {
  return /\.mdx?$/i.test(path);
}

function CanvasLayout() {
  const { document: doc, closeDocument } = useCanvas();

  // One Thread instance whose container changes layout when a document is
  // open. Rendering the two states as separate branches would remount the
  // whole thread on every canvas open/close — which looked like a page
  // refresh when clicking a file link.
  return (
    <SubagentRunsProvider>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          doc && "md:flex-row",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            doc
              ? "max-md:flex-1 md:w-[26rem] md:shrink-0 md:border-r md:border-border/60"
              : "flex-1",
          )}
        >
          <Thread components={{ TaskGroup }} />
        </div>
        {doc && (
          <div className="border-border/60 bg-background flex min-h-0 flex-1 flex-col max-md:h-80 max-md:shrink-0 max-md:border-t md:border-l">
            <CanvasSplitHeader
              title={doc.path}
              version={doc.version}
              saved={!doc.running}
              onCopy={
                doc.content
                  ? () => navigator.clipboard.writeText(doc.content)
                  : undefined
              }
              onClose={closeDocument}
            />
            <CanvasSplitBody writing={doc.running} className="min-h-0 flex-1">
              {doc.content ? (
                isMarkdownPath(doc.path) ? (
                  <MarkdownContent
                    text={doc.content}
                    className="mx-auto max-w-[65ch] text-[13px]"
                  />
                ) : (
                  <CanvasSplitLine className="font-mono text-xs whitespace-pre-wrap">
                    {doc.content}
                  </CanvasSplitLine>
                )
              ) : null}
            </CanvasSplitBody>
          </div>
        )}
      </div>
    </SubagentRunsProvider>
  );
}

function EveErrorToast() {
  const eveError = useEveError();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(null);
  }, [eveError]);

  const message = eveError?.message ?? null;

  if (!message || dismissed === message) {
    return null;
  }

  return (
    <ErrorToast message={message} onDismiss={() => setDismissed(message)} />
  );
}

function SessionCursorPersistence({
  chatId,
  storageMode,
}: {
  readonly chatId: string | null;
  readonly storageMode: StorageMode;
}) {
  const session = useEveSession();

  useEffect(() => {
    if (!chatId || !session?.sessionId) {
      return;
    }

    void saveClientChatSession(storageMode, { chatId, session }).catch(
      () => {},
    );
  }, [chatId, session, storageMode]);

  return null;
}
