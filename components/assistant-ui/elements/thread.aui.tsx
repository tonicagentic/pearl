"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { File } from "@/components/assistant-ui/elements/file";
import { AssistantThinking } from "@/components/assistant-ui/elements/assistant-thinking";
import {
  SessionTimeline,
  isTimelineCoveredPart,
  isTimelineToolCall,
} from "@/components/assistant-ui/elements/session-timeline";
import { SessionTodoList } from "@/components/assistant-ui/elements/todo-list";
import { useLargePasteComposer, useHeldLargePastes } from "@/app/_components/large-paste";
import { ComposerModePicker } from "@/app/_components/mode-picker";
import { ComposerModelPicker } from "@/app/_components/model-picker";
import { ComposerRemoteAgentPicker } from "@/app/_components/remote-agent-picker";
import { buildApprovalBrief } from "@/lib/chat/approval-brief";
import { splitPasteBlocks } from "@/lib/chat/large-paste";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { ThreadSuggestedPrompts } from "@/components/assistant-ui/elements/suggested-prompts.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import { AssistantInlineText } from "@/components/json-render/chat-json-render";
import { proseFromMessageText } from "@/lib/json-render/inline-spec";
import {
  CitationInteractionProvider,
  MessageSources,
  SourcePart,
} from "@/components/assistant-ui/elements/citation";
import { useOptionalQuickPath } from "@/components/assistant-ui/elements/quick-path-context";
import { QuickTurnsOverlay } from "@/components/assistant-ui/elements/quick-turns-overlay";
import { SaveQuoteSelection } from "@/components/assistant-ui/elements/save-quote-selection";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import { DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { messageEnter, mono } from "@/components/assistant-ui/elements/surfaces";
import {
  formatMessageDay,
  formatMessageTime,
  shouldShowDaySeparator,
} from "@/lib/chat/message-day";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  ErrorPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  groupPartByType,
  INTERNAL,
  MessagePrimitive,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type TextMessagePartComponent,
  type ToolCallMessagePartComponent,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BrainIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  MicIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEveEvents } from "@assistant-ui/eve";
import { chatNeedsAuthorization } from "@/lib/chat/events";
import type { SessionStreamEvent } from "eve/client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type FC,
  type KeyboardEvent,
  useEffect,
  useRef,
} from "react";

const emptySubscribe = () => () => {};
/** Day labels use the local calendar; wait for the client to avoid SSR mismatch. */
const useHydrated = () =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

const APPROVAL_OPTION_DEFAULT_LABELS: Record<string, string> = {
  "allow-once": "Allow",
  "allow-always": "Always allow",
  "reject-once": "Deny",
  "reject-always": "Always deny",
};

const isKnownApprovalKind = (kind: string) =>
  Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, kind);

type WaitingApprovalOption = {
  readonly id: string;
  readonly label: string;
  readonly kind?: string;
};

type PendingComposerApproval = {
  readonly messageIndex: number;
  readonly toolCallId: string;
  readonly approvalId: string;
  readonly prompt: string;
  readonly detail?: string;
  readonly options: readonly WaitingApprovalOption[];
  /** Options are local Approve/Cancel stand-ins; respond with approved boolean. */
  readonly syntheticOptions: boolean;
};

const TURN_BUSY_RE =
  /already processing a turn|turnPolicy:\s*"steer"/i;

function isTurnBusyError(cause: unknown): boolean {
  return cause instanceof Error && TURN_BUSY_RE.test(cause.message);
}

function approvalArgs(
  args: unknown,
): Record<string, unknown> | null {
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  return args as Record<string, unknown>;
}

function getPendingComposerApproval(
  s: AssistantState,
): PendingComposerApproval | null {
  const messages = s.thread.messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    // Keep scanning incomplete messages: a stop/error mid-park can flip
    // status while the approval part is still open, and skipping here was
    // leaving a buttonless "waiting" banner with no Approve/Cancel.

    for (const part of message.parts) {
      if (part.type !== "tool-call" || !part.approval) continue;
      if (
        part.approval.approved !== undefined ||
        part.approval.resolution !== undefined
      ) {
        continue;
      }
      // Free-form questions stay in the in-thread ToolFallback UI.
      if (part.approval.display === "text") continue;

      const declared = part.approval.options;
      const syntheticOptions = !declared || declared.length === 0;
      const options: WaitingApprovalOption[] = syntheticOptions
        ? [
            { id: "approve", label: "Approve" },
            { id: "cancel", label: "Cancel" },
          ]
        : declared.map((option) => ({
            id: option.id,
            label:
              option.label ??
              (isKnownApprovalKind(option.kind)
                ? APPROVAL_OPTION_DEFAULT_LABELS[option.kind]
                : undefined) ??
              option.id,
            kind: option.kind,
          }));

      const brief = buildApprovalBrief({
        toolName: part.toolName,
        prompt:
          part.approval.prompt?.trim() ||
          `Approve tool call: ${part.toolName}`,
        input: approvalArgs(part.args),
      });
      return {
        messageIndex: index,
        toolCallId: part.toolCallId,
        approvalId: part.approval.id,
        prompt: brief.headline,
        ...(brief.detail ? { detail: brief.detail } : {}),
        options,
        syntheticOptions,
      };
    }
  }
  return null;
}

/** Primitive snapshot for useAuiState — returning a fresh object each call loops. */
function getPendingComposerApprovalKey(s: AssistantState): string {
  const pending = getPendingComposerApproval(s);
  return pending ? JSON.stringify(pending) : "";
}

function parsePendingComposerApproval(
  key: string,
): PendingComposerApproval | null {
  if (!key) return null;
  return JSON.parse(key) as PendingComposerApproval;
}

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  TaskGroup?:
    | ComponentType<{ group: ThreadGroupPart }>
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  autoFocus?: boolean | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className="animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]"
  >
    <span className="sr-only">Loading conversation</span>
    <Skeleton className="ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
    </div>
    <Skeleton className="ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-10/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  autoFocus = true,
}) => {
  const threadEmpty = useAuiState(isNewChatView);
  const quick = useOptionalQuickPath();
  const hasQuick =
    Boolean(quick?.turns.length) ||
    Boolean(quick?.streamingText) ||
    Boolean(quick?.isStreaming);
  const isEmpty = threadEmpty && !hasQuick;

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} autoFocus={autoFocus} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean; autoFocus: boolean }> = ({
  isEmpty,
  autoFocus,
}) => {
  const { Welcome } = useContext(ThreadComponentsContext);
  const quick = useOptionalQuickPath();
  const hasQuick =
    Boolean(quick?.turns.length) ||
    Boolean(quick?.streamingText) ||
    Boolean(quick?.isStreaming);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-bg" as string]: "var(--color-card)",
        ["--composer-radius" as string]: "1.5rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            isEmpty && "justify-center",
          )}
        >
          {Welcome && !hasQuick ? (
            <AuiIf condition={isNewChatView}>
              <Welcome />
            </AuiIf>
          ) : null}
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          <QuickTurnsOverlay />

          <div
            data-slot="aui_message-group"
            className="mb-14 flex flex-col gap-y-6 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty &&
                "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
            )}
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <WaitingActionDock />
            <ThreadSuggestedPrompts />
            <Composer autoFocus={autoFocus} />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

// eve delivers background-task notifications as user messages with stable
// prefixes (tasks/steps.js formatTaskNotification). Hide them from the
// transcript and from day-boundary walking.
const TASK_NOTIFICATION_PATTERN =
  /^Background task task_[a-z0-9]+( \([^)]*\))?( is completed| failed| is cancelled| needs input| update:| needs authorization)?/i;

function isHiddenThreadMessage(message: {
  readonly role: string;
  readonly parts?: readonly { readonly type: string; readonly text?: string }[];
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
}): boolean {
  if (message.role !== "user") return false;
  const parts = message.parts ?? message.content ?? [];
  return parts.some(
    (part) =>
      part.type === "text" &&
      TASK_NOTIFICATION_PATTERN.test(part.text ?? ""),
  );
}

const MessageDayRule: FC = () => {
  const hydrated = useHydrated();
  const label = useAuiState((s) => {
    if (isHiddenThreadMessage(s.message)) return null;
    const current = s.message.createdAt;
    let previous: Date | undefined;
    for (let i = s.message.index - 1; i >= 0; i -= 1) {
      const earlier = s.thread.messages[i];
      if (!earlier || isHiddenThreadMessage(earlier)) continue;
      previous = earlier.createdAt;
      break;
    }
    if (!shouldShowDaySeparator(current, previous)) return null;
    return formatMessageDay(current);
  });
  if (!hydrated || !label) return null;
  return (
    <div
      data-slot="aui_message-day-rule"
      className="flex items-center gap-2.5 py-1"
    >
      <span className="bg-foreground/[0.08] h-px flex-1" />
      <span className={cn(mono, "text-muted-foreground")}>{label}</span>
      <span className="bg-foreground/[0.08] h-px flex-1" />
    </div>
  );
};

const MessageTime: FC<{ className?: string }> = ({ className }) => {
  const time = useAuiState((s) => {
    if (isHiddenThreadMessage(s.message)) return null;
    const at = s.message.createdAt;
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) return null;
    return formatMessageTime(at);
  });
  if (!time) return null;
  return (
    <span
      data-slot="aui_message-time"
      className={cn(
        mono,
        "text-foreground/0 group-hover:text-foreground/30 group-focus-within:text-foreground/30 shrink-0 tabular-nums transition-colors",
        className,
      )}
    >
      {time}
    </span>
  );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  const body = isEditing ? (
    <EditComposer />
  ) : role === "user" ? (
    <UserMessage />
  ) : (
    <AssistantMessageComponent />
  );

  return (
    <>
      <MessageDayRule />
      {body}
    </>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const WaitingActionDock: FC = () => {
  const aui = useAui();
  // Select a string key: a fresh object from useAuiState trips React's
  // getSnapshot caching check and infinite-loops the render.
  const pendingKey = useAuiState(getPendingComposerApprovalKey);
  const pending = useMemo(
    () => parsePendingComposerApproval(pendingKey),
    [pendingKey],
  );
  const events = useEveEvents();
  // Only authorization parks use the text-only fallback. Orphaned
  // `input.requested` after a cancelled tool approval must not leave a
  // buttonless "Waiting for your confirmation" card.
  const needsAuthorization = chatNeedsAuthorization(
    events as readonly SessionStreamEvent[],
  );

  if (pending) {
    return (
      <WaitingActionCard
        kind="approval"
        title="The agent is paused until you respond."
        prompt={pending.prompt}
        detail={pending.detail}
        options={pending.options}
        onRespond={async (optionId) => {
          const sendApproval = async () => {
            const part = aui.thread
              .message({ index: pending.messageIndex })
              .part({ toolCallId: pending.toolCallId });
            if (pending.syntheticOptions) {
              await part.respondToToolApproval({
                approved: optionId === "approve",
              });
              return;
            }
            const option = pending.options.find(
              (entry) => entry.id === optionId,
            );
            if (option?.kind && isKnownApprovalKind(option.kind)) {
              await part.respondToToolApproval({ optionId });
              return;
            }
            await part.respondToToolApproval({
              optionId,
              approved: true,
            });
          };

          try {
            await sendApproval();
          } catch (cause) {
            // A click while the park is still streaming (or a second click
            // after the first already resumed the turn) hits eve's steer
            // gate. Wait for the active turn to settle, then retry once.
            if (!isTurnBusyError(cause)) throw cause;
            await waitForThreadIdle(aui);
            await sendApproval();
          }
        }}
      />
    );
  }

  if (needsAuthorization) {
    return (
      <WaitingActionCard
        kind="authorization"
        title="The agent is paused on a question or approval above — reply to continue."
      />
    );
  }

  return null;
};

async function waitForThreadIdle(
  aui: ReturnType<typeof useAui>,
  timeoutMs = 15_000,
): Promise<void> {
  if (!aui.thread.getState().isRunning) return;
  const runtime = aui.thread.__internal_getRuntime?.();
  if (runtime) {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(
          new Error(
            "Timed out waiting for the agent to pause before recording your approval.",
          ),
        );
      }, timeoutMs);
      const unsubscribe = runtime.subscribe(() => {
        if (runtime.getState().isRunning) return;
        window.clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
    return;
  }
  const started = Date.now();
  while (aui.thread.getState().isRunning) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        "Timed out waiting for the agent to pause before recording your approval.",
      );
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

const WaitingActionCard: FC<{
  readonly kind: "authorization" | "approval";
  readonly title: string;
  readonly prompt?: string;
  readonly detail?: string;
  readonly options?: readonly WaitingApprovalOption[];
  readonly onRespond?: (optionId: string) => void | Promise<void>;
}> = ({ kind, title, prompt, detail, options, onRespond }) => {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const respond = (optionId: string) => {
    if (submittingRef.current || !onRespond) return;
    submittingRef.current = true;
    setSubmitting(optionId);
    setError(null);
    void (async () => {
      try {
        await onRespond(optionId);
      } catch (cause) {
        submittingRef.current = false;
        setSubmitting(null);
        setError(
          isTurnBusyError(cause)
            ? "The agent was still working — try Approve again."
            : cause instanceof Error
              ? cause.message
              : String(cause),
        );
      }
    })();
  };

  return (
    <div
      data-slot="aui_waiting-action-card"
      role="alert"
      className="animate-in fade-in slide-in-from-bottom-2 border-border/70 bg-card mb-0 overflow-hidden rounded-2xl border px-3.5 py-3 shadow-sm duration-200"
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">
            Waiting for your confirmation.{" "}
          </span>
          {title}
        </p>
        {prompt ? (
          <p className="text-foreground text-sm leading-snug font-medium">
            {prompt}
          </p>
        ) : null}
        {detail ? (
          <pre className="text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-snug">
            {detail}
          </pre>
        ) : null}
      </div>
      {kind === "approval" && options && options.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {options.map((option, index) => {
            const primary = index === 0;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={primary ? "default" : "outline"}
                className="h-9 rounded-full px-4"
                disabled={submitting !== null}
                onClick={() => respond(option.id)}
              >
                {submitting === option.id ? "…" : option.label}
              </Button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive mt-2 text-xs" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const Composer: FC<{ autoFocus: boolean }> = ({ autoFocus }) => {
  const { onComposerPaste } = useLargePasteComposer();
  const aui = useAui();
  const quick = useOptionalQuickPath();
  const sendBlocked = useAuiState((s) => getPendingComposerApprovalKey(s) !== "");
  const quickBusy = Boolean(quick?.isStreaming);

  const sendViaQuickOrEve = async () => {
    if (sendBlocked || quickBusy) return;
    const state = aui.composer.getState();
    const text = state.text?.trim() ?? "";
    const hasAttachments = (state.attachments?.length ?? 0) > 0;
    if (!text && !hasAttachments) return;

    if (quick) {
      const outcome = await quick.tryQuickSend({ text, hasAttachments });
      if (outcome === "answered") {
        aui.composer.setText("");
        return;
      }
    }
    aui.composer.send();
  };

  const blockSendKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    if (sendBlocked || quickBusy) {
      event.preventDefault();
      return;
    }
    if (quick) {
      event.preventDefault();
      void sendViaQuickOrEve();
    }
  };

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          className="border-border/60 data-[dragging=true]:border-ring focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]"
        >
          <ComposerAttachments />
          <PasteAttachments />
          <ComposerPrimitive.Input
            placeholder="Ask anything"
            className="aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none"
            rows={1}
            autoFocus={autoFocus}
            enterKeyHint="send"
            aria-label="Message input"
            onPaste={onComposerPaste}
            onKeyDown={blockSendKeys}
          />
          <ComposerAction
            sendBlocked={sendBlocked}
            quickBusy={quickBusy}
            onQuickSend={quick ? () => void sendViaQuickOrEve() : undefined}
          />
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{
  sendBlocked?: boolean;
  quickBusy?: boolean;
  onQuickSend?: () => void;
}> = ({ sendBlocked = false, quickBusy = false, onQuickSend }) => {
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <div className="flex items-center gap-1">
        <ComposerAddAttachment />
        <ComposerModePicker />
        <ComposerModelPicker />
        <ComposerRemoteAgentPicker />
      </div>
      <div className="flex items-center gap-1.5">
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate asChild>
              <TooltipIconButton
                tooltip="Voice input"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                className="aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-full"
                aria-label="Start voice input"
              >
                <MicIcon className="aui-composer-dictate-icon size-4" />
              </TooltipIconButton>
            </ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation asChild>
              <TooltipIconButton
                tooltip="Stop dictation"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                className="aui-composer-stop-dictation text-destructive size-7 rounded-full"
                aria-label="Stop voice input"
              >
                <SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" />
              </TooltipIconButton>
            </ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          {sendBlocked || quickBusy ? (
            <TooltipIconButton
              tooltip={
                quickBusy
                  ? "Pearl is answering…"
                  : "Respond to the approval above to continue"
              }
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-7 rounded-full"
              aria-label="Send message"
              disabled
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          ) : onQuickSend ? (
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-7 rounded-full"
              aria-label="Send message"
              onClick={onQuickSend}
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          ) : (
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton
                tooltip="Send message"
                side="bottom"
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-send size-7 rounded-full"
                aria-label="Send message"
              >
                <ArrowUpIcon className="aui-composer-send-icon size-4" />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          )}
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-cancel size-7 rounded-full"
              aria-label="Stop generating"
            >
              <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  const retrying = useAuiState((s) => s.thread.isRunning);
  // The retryable content: the parent user message's text, re-sent as a new
  // turn on the parked session.
  const parentText = useAuiState((s) => {
    const parentId = s.message.parentId;
    if (!parentId) return undefined;
    const parent = s.thread.messages?.find((m) => m.id === parentId);
    const text = parent?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("\n")
      .trim();
    return text || undefined;
  });
  const aui = useAui();

  return (
    <MessagePrimitive.Error>
      {retrying ? (
        <div
          role="status"
          data-slot="message-error-retrying"
          className="text-muted-foreground flex items-center gap-2 py-1 text-[13.5px]"
        >
          <RefreshCwIcon className="size-3.5 shrink-0 animate-spin" />
          <span className="shimmer motion-reduce:animate-none">Retrying</span>
        </div>
      ) : (
        <ErrorPrimitive.Root className="border-red-500/20 bg-red-500/[0.06] flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm dark:bg-red-500/10">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-500/80" />
          <ErrorPrimitive.Message className="text-red-600 dark:text-red-400" />
          {parentText && (
            <button
              type="button"
              data-slot="message-error-retry"
              title="Resend the last message"
              onClick={() => aui.thread.append(parentText)}
              className="text-red-600 hover:bg-red-500/10 dark:text-red-400 ms-auto flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            >
              <RefreshCwIcon className="size-3" />
              Retry
            </button>
          )}
        </ErrorPrimitive.Root>
      )}
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    TaskGroup,
  } = useContext(ThreadComponentsContext);

  const messageParts = useAuiState((s) => s.message.parts);
  // A parked HITL tool must leave the timeline so ToolFallback mounts
  // Allow/Deny. Settled timeline tools collapse into the session timeline.
  const isTimelineCovered = (index: number) =>
    isTimelineCoveredPart(messageParts[index]);

  const ACTION_BAR_PT = "pt-1.5";
  // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className={cn(
        messageEnter,
        "group relative -mb-7.5 pb-7.5 [contain-intrinsic-size:auto_200px] [content-visibility:auto]",
      )}
    >
      <CitationInteractionProvider>
        <div
          data-slot="aui_assistant-message-content"
          className="text-foreground flex flex-col gap-3 px-2 text-[15px] leading-6 wrap-break-word"
        >
          <AssistantThinking />
          <SessionTimeline />
          <SessionTodoList />
          <MessageError />
          <SaveQuoteSelection>
            <MessagePrimitive.GroupedParts
              groupBy={groupPartByType({
                reasoning: ["group-chainOfThought", "group-reasoning"],
                "tool-call": ["group-chainOfThought", "group-tool"],
                "standalone-tool-call": [],
              })}
            >
              {({ part, children }) => {
                switch (part.type) {
                  case "group-standalone-tool-call":
                    // Adjacent standalone tool parts (write_file + edit_file)
                    // coalesce into this group; render them inline in order.
                    return <>{children}</>;
                  case "group-chainOfThought":
                    // Reasoning and timeline-covered tool steps render nothing
                    // here; a chain only shows children when it holds something
                    // the timeline does not summarize (a delegated task card).
                    if (part.indices.every(isTimelineCovered)) return null;
                    return <>{children}</>;
                  case "group-tool": {
                    if (part.indices.every(isTimelineCovered)) {
                      // Every tool in the group is summarized by the timeline.
                      return null;
                    }
                    const groupParts = part.indices.map(
                      (index) => messageParts[index],
                    );
                    const isDelegationGroup =
                      groupParts.length > 0 &&
                      groupParts.every(
                        (groupPart) =>
                          groupPart?.type === "tool-call" &&
                          DELEGATION_TOOLS.has(groupPart.toolName),
                      );
                    if (isDelegationGroup) {
                      // Delegated tasks render as task cards (docs:
                      // elements/task-card) instead of a tool group.
                      if (TaskGroup) return <TaskGroup group={part} />;
                      return null;
                    }
                    // Approvals and other non-timeline tools render inline.
                    return <>{children}</>;
                  }
                  case "group-reasoning":
                    // Reasoning is summarized by the timeline.
                    return null;
                  case "text":
                    return <AssistantInlineText />;
                  case "source":
                    return <SourcePart />;
                  case "reasoning":
                    // Summarized by the timeline.
                    return null;
                  case "tool-call":
                    if (part.toolName === "todo") return null;
                    if (isTimelineToolCall(part)) {
                      // Summarized by the timeline above; edit_file's renderer
                      // still mounts through its tool UI for the canvas mirror.
                      return part.toolName === "edit_file" ? part.toolUI : null;
                    }
                    return part.toolUI ?? <ToolFallbackComponent {...part} />;
                  case "data":
                    return part.dataRendererUI;
                  case "file":
                    return (
                      <div data-slot="aui_assistant-message-file" className="py-1">
                        <File {...part} />
                      </div>
                    );
                  case "image":
                    return (
                      <div data-slot="aui_assistant-message-image" className="py-1">
                        <Image {...part} />
                      </div>
                    );
                  case "indicator":
                    // The live status line (AssistantThinking above the parts)
                    // covers this state with a label and elapsed time.
                    return null;
                  default:
                    return null;
                }
              }}
            </MessagePrimitive.GroupedParts>
          </SaveQuoteSelection>
          <MessageSources />
          <MessageError />
        </div>
      </CitationInteractionProvider>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center gap-2", ACTION_BAR_HEIGHT)}
      >
        <MessageTime />
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const messageProse = (parts: readonly { type: string; text?: string }[]) =>
  proseFromMessageText(
    parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n\n"),
  );

const AssistantProseCopy: FC = () => {
  const [copied, setCopied] = useState(false);
  const parts = useAuiState((s) => s.message.parts);
  return (
    <TooltipIconButton
      tooltip={copied ? "Copied" : "Copy"}
      onClick={() => {
        const prose = messageProse(parts);
        if (!prose || !navigator.clipboard) return;
        void navigator.clipboard.writeText(prose).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? (
        <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
      ) : (
        <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
      )}
    </TooltipIconButton>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in slide-in-from-bottom-1 zoom-in-95 fill-mode-both col-start-3 row-start-2 -ms-1 flex gap-1 duration-200 [animation-delay:60ms]"
    >
      <AssistantProseCopy />
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5"
        >
          <ActionBarPrimitive.ExportMarkdown
            onExport={async (content) => {
              const prose = proseFromMessageText(content);
              if (!prose) return;
              const blob = new Blob([prose], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `message-${Date.now()}.md`;
              anchor.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
            }}
            asChild
          >
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-file" className="py-1">
    <File {...part} />
  </div>
);

/**
 * Composer chips for held large pastes (the large-paste flow's rich element):
 * styled like attachment chips but as text snippets, with remove buttons.
 * Also registers a composer input plugin so Backspace on an empty composer
 * removes the most recent paste, Slack-style.
 */
const PasteAttachments: FC = () => {
  const { heldPastes, removePaste } = useLargePasteComposer();
  const aui = useAui();
  const pluginRegistry = INTERNAL.useComposerInputPluginRegistryOptional();
  const heldRef = useRef(heldPastes);
  heldRef.current = heldPastes;

  useEffect(() => {
    if (!pluginRegistry) {
      return;
    }

    return pluginRegistry.register({
      handleKeyDown(e) {
        if (e.key !== "Backspace") {
          return false;
        }

        if ((aui.composer.getState().text ?? "").length > 0) {
          return false;
        }

        const last = heldRef.current.at(-1);

        if (!last) {
          return false;
        }

        removePaste(last.id);
        return true;
      },
      setCursorPosition() {},
    });
  }, [aui, pluginRegistry, removePaste]);

  if (heldPastes.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="aui_composer-pastes"
      className="flex w-full flex-row flex-wrap items-center gap-2"
    >
      {heldPastes.map((paste) => (
        <div
          key={paste.id}
          data-slot="aui_composer-paste"
          className="border-border/60 bg-background flex items-center gap-1.5 rounded-md border px-2 py-1"
        >
          <FileTextIcon className="text-muted-foreground size-3.5" />
          <span className="text-xs">
            Pasted text
            <span className="text-muted-foreground">
              {" · "}
              {paste.charCount.toLocaleString("en-US")} chars
            </span>
          </span>
          <button
            type="button"
            aria-label={`Remove pasted text (${paste.charCount.toLocaleString("en-US")} characters)`}
            className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
            onClick={() => removePaste(paste.id)}
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

/**
 * User-message text renderer: paste blocks (the delimited inline blocks the
 * large-paste flow produces) render collapsed with a character-count summary
 * the reader can expand; every other segment renders like the default Text
 * part (pre-line paragraph). The message text itself is unchanged, so the
 * agent still receives the full content.
 */
const UserTextPart: TextMessagePartComponent = ({ text }) => {
  const segments = splitPasteBlocks(text);

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" && segment.text.trim().length === 0 ? null : segment.kind ===
          "paste" ? (
          <details
            key={`paste-${segment.id}-${index}`}
            className="group border-border/70 bg-background/60 my-1 rounded-lg border"
          >
            <summary className="text-muted-foreground flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 text-xs select-none">
              <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90 [[open]>&]:rotate-90" />
              Pasted text · {segment.charCount.toLocaleString("en-US")} characters
            </summary>
            <pre className="max-h-64 overflow-auto px-3 pb-2 font-mono text-xs whitespace-pre-wrap">
              {segment.content}
            </pre>
          </details>
        ) : (
          <p key={`text-${index}`} style={{ whiteSpace: "pre-line" }}>
            {segment.text}
          </p>
        ),
      )}
    </>
  );
};

const UserImagePart: ImageMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-image" className="py-1">
    <Image {...part} />
  </div>
);

const UserMessage: FC = () => {
  // Background subagent runs report back through the model-facing channel: eve
  // delivers the task notification as a user message ("Background task … is
  // completed. Result: …") so the conversation history carries the result.
  // That message is runtime plumbing, not something the human said — hide it
  // from the thread; the assistant's reply to it is the user-facing summary.
  const isTaskNotification = useAuiState((s) =>
    isHiddenThreadMessage(s.message),
  );
  if (isTaskNotification) return null;

  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className={cn(
        messageEnter,
        "group grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2",
      )}
      data-role="user"
    >
      <MessageTime className="!col-start-1 row-start-1 self-end justify-self-end pe-2" />

      <UserMessageAttachments />

      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
          <MessagePrimitive.Parts
            components={{ File: UserFilePart, Image: UserImagePart, Text: UserTextPart }}
          />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  const { onComposerPaste } = useLargePasteComposer();

  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg)">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
          onPaste={onComposerPaste}
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3.5"
            >
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" className="h-8 rounded-full px-3.5">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
