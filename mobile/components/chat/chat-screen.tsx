import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Platform, View } from "react-native";
import { router, useNavigation } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModal as BottomSheetModalRef,
} from "@expo/ui/community/bottom-sheet";
import {
  AssistantRuntimeProvider,
  MessageNotSentError,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import {
  AlignJustifyIcon,
  MonitorIcon,
  SquarePenIcon,
} from "lucide-react-native";

import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EveAuthorization } from "@/components/assistant-ui/elements/authorization";
import { useHistorySidebarOptional } from "@/components/navigation/drawer-context";
import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { SignupSheet } from "@/components/signup-sheet";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { ComputerPanel } from "@/components/computer-panel";
import { AgentSettingsModal } from "@/components/custom-agents/agent-settings-modal";
import { FileCanvas } from "@/components/file-canvas";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import {
  PEARL_IDENTITY_ACCENT,
  PEARL_MARK_HEIGHT_RATIO,
  ThreadIdentityMenu,
  type ThreadIdentityAgentOption,
} from "@/components/thread-identity-menu";
import { StackScreen } from "@/components/ui/stack-screen";
import { useAuth } from "@/src/auth";
import { getAgentMode } from "@/src/agent-mode";
import { fetchCustomAgents } from "@/src/custom-agents-client";
import { withPendingAssistant } from "@/src/stream-presentation";
import { applyLiveReplyOverlay } from "@/src/apply-live-reply";
import {
  getLiveReplyVersion,
  reconcileLiveReplyWithSnapshot,
  subscribeLiveReplyText,
} from "@/src/live-reply-text";
import { buildTurnClientContext } from "@/src/turn-client-context";
import { isEditableCanvasPath } from "../../../lib/design/file-preview";
import { useWorkspace } from "@/src/workspace-context";
import {
  appendQuickTurnMessages,
  appendSpokenTurnMessages,
  composerWaitingQuestions,
  getPendingApprovals,
  hasPendingAction,
  isTextOnlyPendingQuestion,
  pendingWaitKind,
  showReplyInterruptedNotice,
  spokenTurnsPendingImport,
  type PendingApproval,
} from "@/src/message-projection";
import { readQuickPathStream } from "../../../lib/chat/quick-path-stream";
import { canUseQuickPath } from "../../../lib/pearl-lane";
import { DEFAULT_MODEL_KEY, getModelSelection } from "@/src/model-selection";
import { getRemoteAgentSelection } from "@/src/remote-agent-selection";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { formatEveClientError } from "@/src/chat/eve-error";
import { classifyThreadNotice } from "@/src/chat/thread-notice";
import { resolveTurnPolicy } from "@/src/chat/prepare-send";
import { deriveTurnRunning } from "@/src/chat/turn-running";
import { activeTurn } from "eve/events";
import type { WaitingAction } from "@/components/assistant-ui/elements/waiting-action-card";
import { SubagentTranscriptSheet } from "@/components/assistant-ui/elements/subagent-transcript-sheet";
import { createAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import {
  applyAttachmentHolds,
  createAttachmentHold,
  createLocalSend,
  hasConfirmedSend,
  hasUnresolvedSend,
  holdSatisfied,
  projectSendMessages,
  type AttachmentHold,
  type LocalSend,
} from "@/src/send-feedback";
import { EveEventsProvider, useChats } from "@/src/chat-context";
import {
  ConversationProvider,
  agentForCall,
  useChatConversation,
} from "@/src/conversation-context";
import {
  SubagentInspectProvider,
  useSubagentInspect,
} from "@/src/subagent-inspect-context";
import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { OfflineBanner } from "@/components/offline-banner";
import { toThreadMessages } from "@/src/eve-transport";
import { useNetworkStatus } from "@/src/network-status";
import { sendWithRetry } from "@/src/send-retry";
import { turnEndedWithoutAssistant } from "../../../lib/chat/empty-turn";

const COMPUTER_SHEET_SNAP_POINTS = ["92%"] as const;

/**
 * Nested chat thread (route `/chat`): assistant-ui Thread over the eve session.
 * System back / swipe-pop returns to home.
 *
 * `embedded` renders the same thread under the Home Pearl tab (no chat
 * header/toolbar — Home owns the nav chrome) with immediate composer focus.
 */
export function ChatScreen({
  chromeRevealed = true,
  embedded = false,
}: {
  /** False while the auth→composer morph overlay owns the transition. */
  chromeRevealed?: boolean;
  /** Home Pearl tab: skip stack header/toolbar; autofocus without waiting for push. */
  embedded?: boolean;
} = {}) {
  const {
    billingReady,
    markBillingReady,
    needsSignup,
    isAnonymous,
    refreshGuestGate,
  } = useAuth();
  const {
    store,
    activeChatId,
    activeProjectId,
    setActiveProjectId,
    setChatProject,
    activeCustomAgent,
    setActiveCustomAgent,
    newChatEntry,
    newChat,
    selectChat,
    persistenceError,
    connectionError,
    clearConnectionError,
    retrySync,
    pendingMessage,
    deleteChat,
    wasSendPrepared,
    clearPendingMessage,
    clearSessionRecovery,
    recoverDeadSession,
    reconnect,
    spokenTurns,
    quickTurns,
    setQuickTurns,
    patchChatMeta,
  } = useChats();
  const { offline } = useNetworkStatus();
  const [quickStreamingText, setQuickStreamingText] = useState("");
  const [quickStreaming, setQuickStreaming] = useState(false);
  const { setChatId, tabs, preferDetail, canvasOpen, openFile } =
    useWorkspace();
  const [computerOpen, setComputerOpen] = useState(false);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [switchableAgents, setSwitchableAgents] = useState<
    readonly ThreadIdentityAgentOption[]
  >([]);
  const computerSheetRef = useRef<BottomSheetModalRef>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const tabCountRef = useRef(tabs.length);
  const navigation = useNavigation();
  // Defer new-chat autofocus until the stack push finishes so keyboard +
  // composer morph do not fight the transition. Embedded Pearl tab skips this.
  const [navSettled, setNavSettled] = useState(embedded);
  /** Queued while the Computer sheet closes — RN Modal can't beat the sheet. */
  const pendingCanvasRef = useRef<{
    readonly id?: string;
    readonly path: string;
    readonly content: string;
  } | null>(null);

  const presentComputer = useCallback(() => {
    dismissKeyboard();
    computerSheetRef.current?.present();
    setComputerOpen(true);
  }, []);

  const dismissComputer = useCallback(() => {
    computerSheetRef.current?.dismiss();
    setComputerOpen(false);
  }, []);

  const flushPendingCanvas = useCallback(() => {
    const pending = pendingCanvasRef.current;
    if (!pending) return;
    pendingCanvasRef.current = null;
    openFile({
      id: pending.id,
      path: pending.path,
      content: pending.content,
      openCanvas: true,
    });
  }, [openFile]);

  const openEditableFromComputer = useCallback(
    (file: {
      readonly id?: string;
      readonly path: string;
      readonly content: string;
    }) => {
      pendingCanvasRef.current = file;
      dismissComputer();
      // Fallback if the sheet never reports close (already dismissed, etc.).
      setTimeout(() => {
        flushPendingCanvas();
      }, 450);
    },
    [dismissComputer, flushPendingCanvas],
  );

  useEffect(() => {
    setChatId(activeChatId);
  }, [activeChatId, setChatId]);

  // New chat + custom-agent threads: load agents so the identity pill can switch.
  const allowAgentSwitch =
    !isAnonymous && (activeChatId === null || Boolean(activeCustomAgent));
  useEffect(() => {
    if (!allowAgentSwitch || !billingReady) {
      setSwitchableAgents([]);
      return;
    }
    let cancelled = false;
    void fetchCustomAgents()
      .then((rows) => {
        if (cancelled) return;
        setSwitchableAgents(
          rows.map((agent) => ({
            id: agent.id,
            name: agent.name,
            accent: agent.accent,
            markShape: agent.markShape,
            markTalk: agent.markTalk,
            markBrows: agent.markBrows,
            markGaze: agent.markGaze,
            chatId: agent.chatId,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setSwitchableAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [allowAgentSwitch, billingReady, activeCustomAgent?.id, newChatEntry]);

  useEffect(() => {
    if (!isAnonymous && signupOpen) setSignupOpen(false);
  }, [isAnonymous, signupOpen]);

  useEffect(() => {
    if (embedded) {
      setNavSettled(true);
      return;
    }
    // Only gate the new-chat autofocus path.
    if (!(Platform.OS === "ios" && activeChatId === null && chromeRevealed)) {
      return;
    }
    setNavSettled(false);
    let settled = false;
    const markSettled = () => {
      if (settled) return;
      settled = true;
      setNavSettled(true);
    };
    const unsub = navigation.addListener(
      "transitionEnd" as never,
      ((event: { data?: { closing?: boolean } }) => {
        if (event?.data?.closing) return;
        markSettled();
      }) as never,
    );
    // No animation / missed event: still focus after a beat.
    const fallback = setTimeout(markSettled, 450);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, [embedded, navigation, activeChatId, chromeRevealed, newChatEntry]);

  // Pearl tab should always be a Pearl draft — clear custom-agent context.
  useEffect(() => {
    if (!embedded) return;
    if (activeCustomAgent != null) newChat();
  }, [embedded, activeCustomAgent, newChat]);

  // Auto-present Computer for browser/non-text tabs. Text write_file claims
  // stay as an inline Writing card until the user opens the canvas.
  useEffect(() => {
    const prev = tabCountRef.current;
    tabCountRef.current = tabs.length;
    if (prev === 0 && tabs.length > 0) {
      if (canvasOpen) {
        dismissComputer();
        return;
      }
      const onlyEditableFiles = tabs.every(
        (tab) => tab.kind === "file" && isEditableCanvasPath(tab.path),
      );
      if (onlyEditableFiles) return;
      presentComputer();
    } else if (tabs.length === 0 && prev > 0) {
      dismissComputer();
    }
  }, [canvasOpen, dismissComputer, presentComputer, tabs]);

  // Chat-launched non-editable opens surface the Computer sheet.
  useEffect(() => {
    if (!preferDetail) return;
    presentComputer();
  }, [preferDetail, presentComputer]);

  // Editable canvas owns the screen — tuck Computer away.
  useEffect(() => {
    if (!canvasOpen) return;
    dismissComputer();
  }, [canvasOpen, dismissComputer]);

  const projectPickWaiter = useRef<{
    resolve: (projectId: string) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const autoSentPendingFor = useRef<string | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const [projectLabel, setProjectLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setProjectLabel(null);
      return;
    }
    let cancelled = false;
    void import("@/src/projects-client")
      .then(({ fetchProjects }) => fetchProjects())
      .then((projects) => {
        if (cancelled) return;
        setProjectLabel(
          projects.find((project) => project.id === activeProjectId)?.name ??
            "Project",
        );
      })
      .catch(() => {
        if (!cancelled) setProjectLabel("Project");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const openProjectPicker = useCallback(() => {
    setProjectPickerOpen(true);
  }, []);

  const ensureProjectForPlanMode = useCallback(async (): Promise<string | null> => {
    if (getAgentMode() !== "plan") return activeProjectId;
    if (activeProjectId) return activeProjectId;
    return new Promise<string>((resolve, reject) => {
      projectPickWaiter.current = { resolve, reject };
      setProjectPickerOpen(true);
    });
  }, [activeProjectId]);

  const openCost = useCallback(() => {
    dismissKeyboard();
    setCostOpen(true);
  }, []);

  const performDelete = useCallback(() => {
    if (!activeChatId) return;
    void deleteChat(activeChatId).catch(() => {
      Alert.alert("Could not delete", "Check your connection and try again.");
    });
  }, [activeChatId, deleteChat]);

  const confirmDelete = useCallback(() => {
    if (!activeChatId) return;
    Alert.alert(
      "Delete thread?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete,
        },
      ],
    );
  }, [activeChatId, performDelete]);

  const clearProject = useCallback(() => {
    setActiveProjectId(null);
    if (activeChatId) {
      void setChatProject(activeChatId, null).catch(() => {});
    }
  }, [activeChatId, setActiveProjectId, setChatProject]);

  const [sendError, setSendError] = useState<{ store: object; message: string } | null>(null);
  const [saveRetrying, setSaveRetrying] = useState(false);
  const [localSends, setLocalSends] = useState<Map<object, LocalSend>>(() => new Map());
  // Composer image chips kept after deliveryId clears localSend until eve's
  // user row carries a displayable file url (avoids `[file: name]` flash).
  const [attachmentHoldsByStore, setAttachmentHoldsByStore] = useState(
    () => new Map<object, AttachmentHold[]>(),
  );
  // Sticky until eve publishes an assistant row — survives clearing localSend
  // on deliveryId so Thinking does not blank mid-send.
  const [expectingAssistantByStore, setExpectingAssistantByStore] = useState(
    () => new Map<object, boolean>(),
  );
  const localSend = localSends.get(store) ?? null;
  const attachmentHolds = attachmentHoldsByStore.get(store) ?? [];
  const expectingAssistant = expectingAssistantByStore.get(store) ?? false;
  // One subscription for the active store — five separate hooks each paid a
  // full snapshot read on every line boundary.
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot,
  );
  const messages = snapshot.messages;
  const status = snapshot.status;
  const storeError = snapshot.error;
  const events = snapshot.events;
  const agents = snapshot.agents;
  // Freeze followed-child snapshots when the parent turn is settled so
  // following↔caught-up ticks do not rebuild TaskGroup / the aui adapter.
  const turnOpen = activeTurn(snapshot.view) !== undefined;
  const agentsForUiRef = useRef(agents);
  if (turnOpen) {
    agentsForUiRef.current = agents;
  }
  const agentsForUi = turnOpen ? agents : agentsForUiRef.current;
  const conversation = useMemo(
    () => ({ messages, agents: agentsForUi }),
    [messages, agentsForUi],
  );
  const waitKind = useMemo(
    () => pendingWaitKind(conversation),
    [conversation],
  );
  const isBusy = status === "busy";
  // Keep projection "running" if the store briefly idles while the last
  // assistant is still marked streaming — otherwise SettledMarkdown dumps
  // the reply and skips word reveal on Expo Go.
  const lastAssistantStreaming =
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.metadata?.status === "streaming";
  // Prefer activeTurn(view); message heuristics cover optimistic paint gaps.
  const isRunning = deriveTurnRunning({
    status,
    messages,
    view: snapshot.view,
  });
  const hasError = Boolean(storeError);
  const confirmed = localSend ? hasConfirmedSend(events, localSend) : false;
  const waitingForAction = hasPendingAction(conversation);
  const pendingApprovals = useMemo(
    () => getPendingApprovals(conversation),
    [conversation],
  );

  const answerInteraction = useCallback(
    async (response: {
      readonly interactionId: string;
      readonly optionId?: string;
      readonly text?: string;
    }) => {
      await store.send({
        answers: [
          {
            interactionId: response.interactionId,
            ...(response.optionId ? { optionId: response.optionId } : {}),
            ...(response.text !== undefined ? { text: response.text } : {}),
          },
        ],
        clientContext: buildTurnClientContext(activeProjectId, activeChatId, activeCustomAgent?.id),
      });
    },
    [store, activeProjectId],
  );

  // Text-only asks answer through the normal composer; only choice (and mixed
  // multi-ask) stacks morph the shell into the Questions card.
  const onlyTextQuestionsPending =
    pendingApprovals.length > 0 &&
    pendingApprovals.every(isTextOnlyPendingQuestion);
  const composerBlocked =
    waitingForAction && !onlyTextQuestionsPending;
  const unresolvedSend = hasUnresolvedSend(events, localSend, pendingMessage);
  const sendPreparing =
    unresolvedSend && localSend?.phase !== "uncertain";

  const waitingAction = useMemo((): WaitingAction | null => {
    const questions = composerWaitingQuestions(pendingApprovals);
    if (questions.length > 0) {
      const sendAnswer = async (
        pending: PendingApproval,
        response: { readonly optionId?: string; readonly text?: string },
      ) => {
        await store.send({
          answers: [
            {
              interactionId: pending.requestId,
              ...(response.optionId ? { optionId: response.optionId } : {}),
              ...(response.text !== undefined ? { text: response.text } : {}),
            },
          ],
          clientContext: buildTurnClientContext(activeProjectId, activeChatId, activeCustomAgent?.id),
        });
      };
      return {
        kind: "questions",
        items: questions.map((pending) => ({
          id: pending.requestId,
          prompt: pending.prompt,
          ...(pending.detail ? { detail: pending.detail } : {}),
          options: pending.options,
          allowFreeform: pending.allowFreeform,
          ...(pending.dismissible ? { dismissible: true } : {}),
          ...(pending.skipOptionId
            ? { skipOptionId: pending.skipOptionId }
            : {}),
        })),
        onRespond: async (response) => {
          const pending = questions.find(
            (item) => item.requestId === response.interactionId,
          );
          if (!pending) return;
          await sendAnswer(pending, response);
        },
        onSkip: async (itemId) => {
          const pending = questions.find((item) => item.requestId === itemId);
          if (!pending) return;
          if (pending.skipOptionId) {
            await sendAnswer(pending, { optionId: pending.skipOptionId });
            return;
          }
          if (pending.dismissible && pending.allowFreeform) {
            await sendAnswer(pending, { text: "" });
          }
        },
      };
    }

    const approval = pendingApprovals.find(
      (pending) => pending.kind === "approval",
    );
    if (approval) {
      return {
        kind: "approval",
        title: "The agent is paused until you respond.",
        prompt: approval.prompt,
        detail: approval.detail,
        options: approval.options,
        onRespond: async (response) => {
          await store.send({
            answers: [
              {
                interactionId: approval.requestId,
                ...(response.optionId ? { optionId: response.optionId } : {}),
                ...(response.text !== undefined ? { text: response.text } : {}),
              },
            ],
            clientContext: buildTurnClientContext(activeProjectId, activeChatId, activeCustomAgent?.id),
          });
        },
      };
    }

    if (composerBlocked) {
      return {
        kind: "authorization",
        title:
          "The agent is paused on a question or approval above — reply to continue.",
      };
    }

    return null;
  }, [
    pendingApprovals,
    composerBlocked,
    store,
    activeProjectId,
  ]);
  const awaitingReply = Boolean(
    expectingAssistant
      || (localSend && localSend.phase === "preparing" && !confirmed),
  );
  // Parent transcript only — do not depend on `agents` / `conversation` or
  // every followed-child delta rebuilds the assistant-ui adapter.
  const pendingSpoken = useMemo(
    () => spokenTurnsPendingImport(spokenTurns, messages),
    [spokenTurns, messages],
  );
  const pendingQuick = useMemo(() => {
    const imported = new Set(
      messages
        .map((message) => message.metadata?.historyId)
        .filter((id): id is string => typeof id === "string"),
    );
    return quickTurns.filter((turn) => !imported.has(turn.id));
  }, [quickTurns, messages]);
  // Per-delta text ahead of eve line commits — paints smaller chunks on device.
  const liveReplyVersion = useSyncExternalStore(
    subscribeLiveReplyText,
    getLiveReplyVersion,
    getLiveReplyVersion,
  );

  useEffect(() => {
    reconcileLiveReplyWithSnapshot(messages);
  }, [messages]);

  const projectedMessages = useMemo(() => {
    const pending = confirmed
      ? null
      : hasError && localSend
        ? { ...localSend, phase: "uncertain" as const }
        : localSend;
    const projected = projectSendMessages(
      toThreadMessages({ messages }, { isRunning, hasError, events }),
      messages,
      pending,
    );
    // Skip holds still covered by the localSend overlay for the same row.
    const activeHolds =
      pending && attachmentHolds.length > 0
        ? attachmentHolds.filter((hold) => hold.baseline !== pending.baseline)
        : attachmentHolds;
    const withHolds = applyAttachmentHolds(projected, messages, activeHolds);
    const base = withPendingAssistant(
      withHolds as Parameters<typeof withPendingAssistant>[0],
      messages,
      isRunning,
      awaitingReply,
    );
    const withLive = applyLiveReplyOverlay(
      base as Parameters<typeof applyLiveReplyOverlay>[0],
    );
    const withSpoken = appendSpokenTurnMessages(
      withLive as ThreadMessageLike[],
      pendingSpoken,
    );
    return appendQuickTurnMessages(
      withSpoken,
      pendingQuick,
      quickStreaming ? quickStreamingText : "",
    );
  }, [
    messages,
    events,
    localSend,
    attachmentHolds,
    confirmed,
    isRunning,
    hasError,
    awaitingReply,
    pendingSpoken,
    pendingQuick,
    quickStreaming,
    quickStreamingText,
    liveReplyVersion,
  ]);

  useEffect(() => {
    if (!expectingAssistant) return;
    if (turnEndedWithoutAssistant(events, messages, isBusy)) {
      setExpectingAssistantByStore((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
      setSendError({
        store,
        message: "Pearl didn't return a reply for this turn.",
      });
      return;
    }
    if (messages[messages.length - 1]?.role === "assistant") {
      setExpectingAssistantByStore((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
      return;
    }
    // Uncertain delivery with an idle store: stop expecting so Thinking
    // does not stick forever after a failed send.
    if (localSend?.phase === "uncertain" && !isBusy) {
      setExpectingAssistantByStore((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
    }
    // Failed turn with no assistant row — release sticky expecting so the
    // display-only placeholder can drop (do not clear on idle alone: eve may
    // be between delivery.consumed and model.started).
    if (
      !isBusy &&
      storeError &&
      messages[messages.length - 1]?.role !== "assistant"
    ) {
      setExpectingAssistantByStore((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
    }
  }, [expectingAssistant, events, isBusy, localSend, messages, store, storeError]);

  // Drop attachment holds once eve's user row carries a displayable image.
  useEffect(() => {
    if (attachmentHolds.length === 0) return;
    const remaining = attachmentHolds.filter(
      (hold) => !holdSatisfied(messages, hold),
    );
    if (remaining.length === attachmentHolds.length) return;
    setAttachmentHoldsByStore((current) => {
      const existing = current.get(store);
      if (!existing || existing.length === 0) return current;
      const nextHolds = existing.filter((hold) => !holdSatisfied(messages, hold));
      if (nextHolds.length === existing.length) return current;
      const next = new Map(current);
      if (nextHolds.length === 0) next.delete(store);
      else next.set(store, nextHolds);
      return next;
    });
  }, [attachmentHolds, messages, store]);

  // Callbacks read from this ref so the adapter object only rebuilds when
  // messages / run flags change — not on every localSend or project id tick.
  // assistant-ui compares `adapter.messages` by reference inside setAdapter,
  // so projectedMessages must still be a direct property (not a shared getter).
  const sendCtxRef = useRef({
    store,
    localSend,
    pendingMessage,
    composerBlocked,
    unresolvedSend,
    activeChatId,
    activeProjectId,
    activeCustomAgentId: activeCustomAgent?.id ?? null,
    wasSendPrepared,
    clearPendingMessage,
    clearSessionRecovery,
    recoverDeadSession,
    reconnect,
    offline,
    patchChatMeta,
    ensureProjectForPlanMode,
    setActiveProjectId,
    quickTurns,
    setQuickTurns,
    setQuickStreamingText,
    setQuickStreaming,
    selectChat,
  });
  useEffect(() => {
    sendCtxRef.current = {
      store,
      localSend,
      pendingMessage,
      composerBlocked,
      unresolvedSend,
      activeChatId,
      activeProjectId,
      activeCustomAgentId: activeCustomAgent?.id ?? null,
      wasSendPrepared,
      clearPendingMessage,
      clearSessionRecovery,
      recoverDeadSession,
      reconnect,
      offline,
      patchChatMeta,
      ensureProjectForPlanMode,
      setActiveProjectId,
      quickTurns,
      setQuickTurns,
      setQuickStreamingText,
      setQuickStreaming,
      selectChat,
    };
  });

  const adapter = useMemo(
    () => ({
      messages: projectedMessages,
      // Return the projection as-is: the runtime's converter assigns stable
      // positional fallback ids (the projection omits ids on purpose) and
      // honors the per-message status it carries.
      convertMessage: (message: ThreadMessageLike) => message,
      isRunning: isRunning || quickStreaming,
      isDisabled: status === "resuming",
      // HITL, in-flight prepare, or unconfirmed prior turn — don't invite a throw.
      isSendDisabled: composerBlocked || unresolvedSend || quickStreaming,
      // Allow send-while-busy via turnPolicy queue (composer checks capabilities.queue).
      capabilities: { cancel: true, queue: true },
      onNew: async (message: AppendMessage) => {
        const ctx = sendCtxRef.current;
        const { store: activeStore } = ctx;
        setSendError(null);
        if (needsSignup) {
          setSignupOpen(true);
          throw new MessageNotSentError(
            "Sign up to continue chatting.",
          );
        }
        if (ctx.composerBlocked) {
          throw new MessageNotSentError(
            "This chat is waiting for authorization or approval.",
          );
        }
        if (ctx.unresolvedSend) {
          const reason =
            ctx.localSend?.phase === "uncertain"
              ? "Couldn't confirm delivery. Your message is still here — resend when you're ready."
              : "Still sending your last message…";
          setSendError({ store: activeStore, message: reason });
          throw new MessageNotSentError(reason);
        }
        let projectIdForTurn = ctx.activeProjectId;
        try {
          projectIdForTurn = await ctx.ensureProjectForPlanMode();
          if (projectIdForTurn) ctx.setActiveProjectId(projectIdForTurn);
        } catch {
          const reason = "Plan mode needs a project before sending.";
          setSendError({ store: activeStore, message: reason });
          throw new MessageNotSentError(reason);
        }
        let turn: ReturnType<typeof toEveTurn>;
        try {
          turn = toEveTurn(message);
        } catch (cause) {
          // Only validation failures are known to have never reached eve.
          // Restore the draft and chips; network failures remain uncertain.
          const reason = cause instanceof Error ? cause.message : "Attachment is not ready.";
          setSendError({ store: activeStore, message: reason });
          throw new MessageNotSentError(reason);
        }

        const hasAttachments = (message.attachments?.length ?? 0) > 0;
        const hasEveSession = Boolean(activeStore.snapshot.session);
        const pinned = getModelSelection() !== DEFAULT_MODEL_KEY;
        if (
          canUseQuickPath({
            text: turn.text,
            hasEveSession,
            hasAttachments,
            hasCustomAgent: Boolean(ctx.activeCustomAgentId),
            hasRemoteAgent: Boolean(getRemoteAgentSelection()),
            hasProject: Boolean(projectIdForTurn),
            hasPinnedModel: pinned,
            quickTurnCount: ctx.quickTurns.length,
          })
        ) {
          const priorQuick = ctx.quickTurns;
          const optimistic = {
            id: `quick:pending:${Date.now()}`,
            role: "user" as const,
            text: turn.text.trim(),
          };
          ctx.setQuickTurns([...priorQuick, optimistic]);
          ctx.setQuickStreaming(true);
          ctx.setQuickStreamingText("");
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          try {
            const credential = getAuthCookie();
            const response = await fetch(`${AGENT_URL}/api/chat/quick`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(credential ? { authorization: `Bearer ${credential}` } : {}),
              },
              body: JSON.stringify({
                chatId: ctx.activeChatId,
                message: turn.text.trim(),
              }),
            });
            if (response.status !== 409) {
              const result = await readQuickPathStream(response, {
                onTextDelta: (delta) => {
                  ctx.setQuickStreamingText((current) => current + delta);
                },
              });
              if (result.outcome === "answered") {
                ctx.setQuickTurns([...result.turns]);
                ctx.setQuickStreaming(false);
                ctx.setQuickStreamingText("");
                if (result.chatId) {
                  ctx.patchChatMeta(result.chatId, {
                    updatedAt: new Date().toISOString(),
                    ...(result.title ? { title: result.title } : {}),
                  });
                  if (result.chatId !== ctx.activeChatId) {
                    await ctx.selectChat(result.chatId);
                  }
                }
                return;
              }
            }
          } catch {
            // Fall through to eve.
          }
          ctx.setQuickTurns(priorQuick);
          ctx.setQuickStreaming(false);
          ctx.setQuickStreamingText("");
        }

        // Match an attachment-only pending row to this exact eve receive event
        // after a force-quit. The token is just a correlation label, not auth.
        const outgoing = !turn.text.trim() && Array.isArray(turn.message)
          ? [{ type: "text" as const, text: createAttachmentMarker() }, ...turn.message]
          : turn.message;
        // Paint the user turn before the durable marker's network round-trip.
        // This row is display-only; Eve still waits for prepareSend to persist it.
        const baseline = activeStore.snapshot.messages.length;
        const preview = createLocalSend(
          activeStore,
          baseline,
          activeStore.snapshot.events.length,
          message,
          outgoing,
        );
        const hold = createAttachmentHold(baseline, message);
        setLocalSends((current) => new Map(current).set(activeStore, preview));
        if (hold) {
          setAttachmentHoldsByStore((current) => {
            const existing = current.get(activeStore) ?? [];
            return new Map(current).set(activeStore, [...existing, hold]);
          });
        }
        setExpectingAssistantByStore((current) => new Map(current).set(activeStore, true));
        // Light tick as the bubble appears; skip validation failures above.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const turnPolicy = resolveTurnPolicy({
          queueEnabled: true,
          turnOpen: activeTurn(activeStore.snapshot.view) !== undefined,
        });
        const sendPayload = {
          message: outgoing,
          clientContext: buildTurnClientContext(
            projectIdForTurn,
            ctx.activeChatId,
            ctx.activeCustomAgentId,
          ),
          ...(turnPolicy ? { turnPolicy } : {}),
        };
        const result = await sendWithRetry(
          {
            store: activeStore,
            wasSendPrepared: ctx.wasSendPrepared,
            recoverDeadSession: ctx.recoverDeadSession,
            clearSessionRecovery: ctx.clearSessionRecovery,
            clearPendingMessage: ctx.clearPendingMessage,
            offline: ctx.offline,
          },
          sendPayload,
          { eventBaseline: preview.eventBaseline },
        );
        if (result.outcome === "accepted") {
          setLocalSends((current) => {
            if (current.get(activeStore)?.preview !== preview.preview) return current;
            const next = new Map(current);
            next.delete(activeStore);
            return next;
          });
          setSendError(null);
          if (isAnonymous) void refreshGuestGate();
          void import("@/src/pending-attachments").then(
            ({ clearPendingAttachments, chatAttachmentKey }) => {
              clearPendingAttachments(chatAttachmentKey(ctx.activeChatId));
            },
          );
          return;
        }
        if (!result.uncertain) {
          setLocalSends((current) => {
            if (current.get(activeStore)?.preview !== preview.preview) return current;
            const next = new Map(current);
            next.delete(activeStore);
            return next;
          });
          setAttachmentHoldsByStore((current) => {
            const existing = current.get(activeStore);
            if (!existing?.length) return current;
            const nextHolds = existing.filter(
              (hold) => hold.baseline !== preview.baseline,
            );
            if (nextHolds.length === existing.length) return current;
            const next = new Map(current);
            if (nextHolds.length === 0) next.delete(activeStore);
            else next.set(activeStore, nextHolds);
            return next;
          });
          setExpectingAssistantByStore((current) => {
            if (!current.has(activeStore)) return current;
            const next = new Map(current);
            next.delete(activeStore);
            return next;
          });
          setSendError({ store: activeStore, message: result.message });
          throw new MessageNotSentError(result.message);
        }
        setLocalSends((current) => {
          if (current.get(activeStore)?.preview !== preview.preview) return current;
          return new Map(current).set(activeStore, {
            ...preview,
            phase: "uncertain",
          });
        });
        setSendError({ store: activeStore, message: result.message });
      },
      onCancel: async () => {
        await sendCtxRef.current.store.cancel();
      },
      onRespondToToolApproval: async (response: { approvalId: string; optionId?: string; approved?: boolean; text?: string }) => {
        const ctx = sendCtxRef.current;
        const hasDecision =
          response.optionId !== undefined || response.approved !== undefined;
        const optionId = hasDecision
          ? (response.optionId ??
            (response.approved ? "approve" : "cancel"))
          : undefined;
        const payload = {
          answers: [
            {
              interactionId: response.approvalId,
              ...(optionId !== undefined ? { optionId } : {}),
              ...(response.text !== undefined ? { text: response.text } : {}),
            },
          ],
          clientContext: buildTurnClientContext(ctx.activeProjectId, ctx.activeChatId, ctx.activeCustomAgentId),
        };
        await sendWithRetry(
          {
            store: ctx.store,
            wasSendPrepared: ctx.wasSendPrepared,
            recoverDeadSession: ctx.recoverDeadSession,
            clearSessionRecovery: ctx.clearSessionRecovery,
            clearPendingMessage: ctx.clearPendingMessage,
            offline: ctx.offline,
          },
          payload,
          { eventBaseline: ctx.store.snapshot.events.length },
        );
      },
    }),
    // Rebuild only when the thread snapshot the runtime compares changes.
    [
      projectedMessages,
      isRunning,
      quickStreaming,
      status,
      composerBlocked,
      unresolvedSend,
      needsSignup,
      isAnonymous,
      refreshGuestGate,
    ],
  );

  // Carry out (and similar) creates a chat with a durable pending marker but no
  // eve receive yet. Auto-send once when the thread is empty — never auto-send
  // when a session/history already exists (re-open must load, not resend).
  useEffect(() => {
    if (!pendingMessage || !activeChatId) return;
    if (status === "busy" || status === "resuming") {
      return;
    }
    const { events, session, messages } = store.snapshot;
    if (events.length > 0 || messages.length > 0 || session) {
      return;
    }
    // Quick-path chats already show their transcript via quickTurns. Never
    // Eve-auto-send the same user line into an empty store.
    if (quickTurns.length > 0) {
      return;
    }
    if (autoSentPendingFor.current === activeChatId) return;
    autoSentPendingFor.current = activeChatId;
    void sendWithRetry(
      {
        store,
        wasSendPrepared,
        recoverDeadSession,
        clearSessionRecovery,
        clearPendingMessage,
        offline,
      },
      {
        message: pendingMessage,
        clientContext: buildTurnClientContext(
          activeProjectId,
          activeChatId,
          activeCustomAgent?.id,
        ),
      },
      { eventBaseline: store.snapshot.events.length },
    );
  }, [
    pendingMessage,
    activeChatId,
    status,
    store,
    activeProjectId,
    activeCustomAgent?.id,
    quickTurns,
    wasSendPrepared,
    recoverDeadSession,
    clearSessionRecovery,
    clearPendingMessage,
    offline,
  ]);

  // Pending marker with history and no delivery.consumed — quiet retry ladder
  // after a force-quit, never a second automatic copy into an empty store.
  useEffect(() => {
    if (!pendingMessage || !activeChatId || localSend) return;
    if (status === "busy" || status === "resuming" || offline) return;
    const { events, session, messages } = store.snapshot;
    const hasHistory =
      events.length > 0 || messages.length > 0 || Boolean(session);
    if (!hasHistory) return;
    if (events.some((event) => event.type === "delivery.consumed")) return;
    if (autoSentPendingFor.current === `retry:${activeChatId}`) return;
    autoSentPendingFor.current = `retry:${activeChatId}`;
    void sendWithRetry(
      {
        store,
        wasSendPrepared,
        recoverDeadSession,
        clearSessionRecovery,
        clearPendingMessage,
        offline,
      },
      {
        message: pendingMessage,
        clientContext: buildTurnClientContext(
          activeProjectId,
          activeChatId,
          activeCustomAgent?.id,
        ),
      },
      { eventBaseline: 0 },
    ).then((result) => {
      if (result.outcome === "failed" && result.uncertain) {
        setSendError({ store, message: result.message });
      }
    });
  }, [
    pendingMessage,
    activeChatId,
    localSend,
    status,
    store,
    offline,
    activeProjectId,
    activeCustomAgent?.id,
    wasSendPrepared,
    recoverDeadSession,
    clearSessionRecovery,
    clearPendingMessage,
  ]);

  const resendStoredMessage = useCallback(async () => {
    if (!localSend?.outgoing) return;
    const pending = localSend;
    const payload = pending.outgoing;
    setSendError(null);
    setLocalSends((current) => {
      const row = current.get(store);
      if (!row) return current;
      return new Map(current).set(store, { ...row, phase: "preparing" });
    });
    const resentHold = createAttachmentHold(pending.baseline, {
      content: pending.preview.content,
      attachments: pending.preview.attachments,
    } as AppendMessage);
    if (resentHold) {
      setAttachmentHoldsByStore((current) => {
        const existing = current.get(store) ?? [];
        if (existing.some((hold) => hold.baseline === resentHold.baseline)) {
          return current;
        }
        return new Map(current).set(store, [...existing, resentHold]);
      });
    }
    setExpectingAssistantByStore((current) => new Map(current).set(store, true));
    const result = await sendWithRetry(
      {
        store,
        wasSendPrepared,
        recoverDeadSession,
        clearSessionRecovery,
        clearPendingMessage,
        offline,
      },
      {
        message: payload as never,
        clientContext: buildTurnClientContext(
          activeProjectId,
          activeChatId,
          activeCustomAgent?.id,
        ),
      },
      { eventBaseline: pending.eventBaseline },
    );
    if (result.outcome === "accepted") {
      setLocalSends((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
      setSendError(null);
      return;
    }
    setLocalSends((current) => {
      const row = current.get(store);
      if (!row) return current;
      return new Map(current).set(store, { ...row, phase: "uncertain" });
    });
    setSendError({ store, message: result.message });
  }, [
    store,
    localSend,
    activeProjectId,
    activeChatId,
    activeCustomAgent?.id,
    wasSendPrepared,
    recoverDeadSession,
    clearSessionRecovery,
    clearPendingMessage,
    offline,
  ]);

  const runtime = useExternalStoreRuntime(adapter);
  const hasLoadedHistory =
    store.snapshot.events.length > 0 ||
    store.snapshot.messages.length > 0 ||
    Boolean(store.snapshot.session);
  const canResend =
    Boolean(localSend?.outgoing) &&
    (localSend?.phase === "uncertain" ||
      (sendError?.store === store && localSend != null));
  const unifiedEveError = formatEveClientError({
    storeError,
    connectionError,
    sendError: sendError?.store === store ? sendError.message : null,
    persistenceError,
  });
  const notice = classifyThreadNotice({
    offline,
    connectionError,
    persistenceError,
    sendError: sendError?.store === store ? sendError.message : null,
    canResend,
    sendPreparing,
    pendingMessage,
    hasLocalSend: Boolean(localSend),
    hasLoadedHistory,
    showReplyInterrupted: showReplyInterruptedNotice(
      hasError,
      isRunning,
      Boolean(localSend),
    ),
    unifiedEveError,
    saveRetrying,
    onReconnect: () => {
      clearConnectionError();
      void reconnect(store);
    },
    onRetrySave: () => {
      setSaveRetrying(true);
      void retrySync().finally(() => setSaveRetrying(false));
    },
    onResend: () => void resendStoredMessage(),
  });

  const toggleComputer = useCallback(() => {
    if (computerOpen) dismissComputer();
    else presentComputer();
  }, [computerOpen, dismissComputer, presentComputer]);
  const openCompose = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissComputer();
    newChat();
  }, [dismissComputer, newChat]);
  const historySidebar = useHistorySidebarOptional();
  const historyOpen = historySidebar?.open ?? false;
  const openHistory = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (historySidebar) {
      historySidebar.openSidebar();
      return;
    }
    router.navigate("/history");
  }, [historySidebar]);
  const openAgentSettings = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAgentSettingsOpen(true);
  }, []);
  const selectPearlAgent = useCallback(() => {
    if (activeCustomAgent == null && activeChatId === null) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    newChat();
  }, [activeChatId, activeCustomAgent, newChat]);
  const selectCustomAgent = useCallback(
    (agent: ThreadIdentityAgentOption) => {
      if (activeCustomAgent?.id === agent.id) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {},
      );
      void selectChat(agent.chatId);
    },
    [activeCustomAgent?.id, selectChat],
  );
  const titleSlot = useMemo(
    () => (
      <ThreadIdentityMenu
        name={activeCustomAgent?.name ?? "Pearl"}
        accent={activeCustomAgent?.accent ?? PEARL_IDENTITY_ACCENT}
        markShape={activeCustomAgent?.markShape}
        markTalk={activeCustomAgent?.markTalk}
        markBrows={activeCustomAgent?.markBrows}
        markGaze={activeCustomAgent?.markGaze}
        heightRatio={
          activeCustomAgent ? undefined : PEARL_MARK_HEIGHT_RATIO
        }
        projectLabel={projectLabel}
        hasProject={Boolean(activeProjectId)}
        canManageThread={Boolean(activeChatId)}
        showAgentSettings={Boolean(activeCustomAgent)}
        onAgentSettings={
          activeCustomAgent ? openAgentSettings : undefined
        }
        onAddOrChangeProject={openProjectPicker}
        onRemoveProject={clearProject}
        onViewCost={openCost}
        onDelete={confirmDelete}
        allowAgentSwitch={allowAgentSwitch}
        agents={switchableAgents}
        currentAgentId={activeCustomAgent?.id ?? null}
        onSelectPearl={selectPearlAgent}
        onSelectAgent={selectCustomAgent}
      />
    ),
    [
      activeChatId,
      activeCustomAgent,
      activeProjectId,
      allowAgentSwitch,
      clearProject,
      confirmDelete,
      openAgentSettings,
      openCost,
      openProjectPicker,
      projectLabel,
      selectCustomAgent,
      selectPearlAgent,
      switchableAgents,
    ],
  );
  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    const hideThreadActions = !activeChatId || Boolean(activeCustomAgent);
    return [
      {
        label: "Open history",
        systemImage: "line.3.horizontal",
        icon: AlignJustifyIcon,
        onPress: openHistory,
        hidden: historyOpen || Boolean(activeCustomAgent),
      },
      {
        label: "New chat",
        systemImage: "square.and.pencil",
        icon: SquarePenIcon,
        onPress: openCompose,
        separateBackground: true,
        hidden: hideThreadActions,
      },
      {
        type: "spacer",
        width: 8,
        hidden: hideThreadActions,
      },
      {
        label: "Computer",
        systemImage: "desktopcomputer",
        icon: MonitorIcon,
        onPress: toggleComputer,
        selected: computerOpen,
        hidden: hideThreadActions,
      },
    ];
  }, [
    activeChatId,
    activeCustomAgent,
    computerOpen,
    historyOpen,
    openCompose,
    openHistory,
    toggleComputer,
  ]);

  const body = (
      <View style={{ flex: 1 }}>
        {!billingReady ? (
          <BillingGateScreen onReady={markBillingReady} />
        ) : (
          <EveEventsProvider events={events}>
            <SubagentRunsProvider>
              <ConversationProvider conversation={conversation} waitKind={waitKind}>
                <SubagentInspectProvider>
                  <AssistantRuntimeProvider runtime={runtime}>
                    <EveAuthorization />
                    <OfflineBanner />
                    <Thread
                      autoFocus={
                        (embedded || Platform.OS === "ios") &&
                        activeChatId === null &&
                        chromeRevealed &&
                        navSettled &&
                        !needsSignup
                      }
                      chromeRevealed={chromeRevealed}
                      conversationId={activeChatId}
                      focusNewChatKey={newChatEntry}
                      notice={notice}
                      waitingAction={waitingAction}
                      signupBlocked={needsSignup}
                    />
                    <BottomSheetModal
                      ref={computerSheetRef}
                      snapPoints={[...COMPUTER_SHEET_SNAP_POINTS]}
                      enablePanDownToClose
                      onChange={(index) => {
                        const open = index >= 0;
                        setComputerOpen(open);
                        if (!open) flushPendingCanvas();
                      }}
                      onClose={() => {
                        setComputerOpen(false);
                        flushPendingCanvas();
                      }}
                    >
                      <BottomSheetView style={{ flex: 1 }}>
                        <ComputerPanel
                          visible={computerOpen}
                          onOpenEditableFile={openEditableFromComputer}
                        />
                      </BottomSheetView>
                    </BottomSheetModal>
                    <FileCanvas />
                  </AssistantRuntimeProvider>
                  <AgentSettingsModal
                    open={agentSettingsOpen}
                    agent={activeCustomAgent}
                    onClose={() => setAgentSettingsOpen(false)}
                    onSaved={setActiveCustomAgent}
                  />
                  <SubagentInspectHost onAnswer={answerInteraction} />
                  <ThreadCostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
                  <ProjectPickerModal
                    open={projectPickerOpen}
                    onClose={() => {
                      setProjectPickerOpen(false);
                      const waiter = projectPickWaiter.current;
                      projectPickWaiter.current = null;
                      waiter?.reject(new Error("Project picker closed."));
                    }}
                    onSelect={(project) => {
                      setActiveProjectId(project.id);
                      if (activeChatId) {
                        void setChatProject(activeChatId, project.id).catch(() => {});
                      }
                      const waiter = projectPickWaiter.current;
                      projectPickWaiter.current = null;
                      waiter?.resolve(project.id);
                    }}
                  />
                  <SignupSheet
                    open={signupOpen}
                    onClose={() => setSignupOpen(false)}
                  />
                </SubagentInspectProvider>
              </ConversationProvider>
            </SubagentRunsProvider>
          </EveEventsProvider>
        )}
      </View>
  );

  if (embedded) {
    return <StackScreen>{body}</StackScreen>;
  }

  return (
    <ScreenChrome
      leading="back"
      contentPaddingTop={0}
      titleSlot={titleSlot}
      actions={chromeActions}
    >
      {body}
    </ScreenChrome>
  );
}

function SubagentInspectHost({
  onAnswer,
}: {
  readonly onAnswer: (response: {
    readonly interactionId: string;
    readonly optionId?: string;
    readonly text?: string;
  }) => Promise<void>;
}) {
  const { target, close } = useSubagentInspect();
  const { conversation } = useChatConversation();
  const liveTarget = useMemo(() => {
    if (!target) return null;
    const agent =
      (target.callId
        ? agentForCall(conversation.agents, target.callId)
        : undefined) ??
      (target.sessionId
        ? conversation.agents?.[target.sessionId]
        : undefined) ??
      target.agent;
    return { ...target, agent };
  }, [target, conversation.agents]);
  const handleAnswer = useCallback(
    async (response: {
      readonly interactionId: string;
      readonly optionId?: string;
      readonly text?: string;
    }) => {
      await onAnswer(response);
      close();
    },
    [onAnswer, close],
  );
  return (
    <SubagentTranscriptSheet
      target={liveTarget}
      onClose={close}
      onAnswer={handleAnswer}
    />
  );
}
