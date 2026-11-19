import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { Stack, useNavigation } from "expo-router";
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
  MonitorIcon,
  SquarePenIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EveAuthorization } from "@/components/assistant-ui/elements/authorization";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { SignupSheet } from "@/components/signup-sheet";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { ComputerPanel } from "@/components/computer-panel";
import { AgentSettingsModal } from "@/components/custom-agents/agent-settings-modal";
import { FileCanvas } from "@/components/file-canvas";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import {
  PEARL_IDENTITY_ACCENT,
  ThreadIdentityMenu,
  type ThreadIdentityAgentOption,
} from "@/components/thread-identity-menu";
import { Icon } from "@/components/ui/icon";
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
import { isEditableCanvasPath } from "../../lib/design/file-preview";
import { useWorkspace } from "@/src/workspace-context";
import {
  appendSpokenTurnMessages,
  composerWaitingQuestions,
  getPendingApprovals,
  hasPendingAction,
  isTextOnlyPendingQuestion,
  pendingWaitKind,
  spokenTurnsPendingImport,
  type PendingApproval,
} from "@/src/message-projection";
import type { WaitingAction } from "@/components/assistant-ui/elements/waiting-action-card";
import { SubagentTranscriptSheet } from "@/components/assistant-ui/elements/subagent-transcript-sheet";
import { createAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import { createLocalSend, hasConfirmedSend, hasUnresolvedSend, projectSendMessages, shouldRestoreUnsentDraft, type LocalSend } from "@/src/send-feedback";
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
import { toThreadMessages } from "@/src/eve-transport";
import { isEveSessionInactive } from "../../lib/chat/eve-session-recovery";

const COMPUTER_SHEET_SNAP_POINTS = ["92%"] as const;

/**
 * Nested chat thread (route `/chat`): assistant-ui Thread over the eve session.
 * System back / swipe-pop returns to home.
 */
export function ChatScreen({
  chromeRevealed = true,
}: {
  /** False while the auth→composer morph overlay owns the transition. */
  chromeRevealed?: boolean;
} = {}) {
  // The safe-area container is a native codegen view, so uniwind's className
  // binding cannot reach it; paint the theme background through style instead
  // so the color extends under the status bar.
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as string | undefined;
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
    retrySync,
    pendingMessage,
    deleteChat,
    wasSendPrepared,
    clearPendingMessage,
    recoverDeadSession,
    spokenTurns,
  } = useChats();
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
  // composer morph do not fight the transition.
  const [navSettled, setNavSettled] = useState(false);
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
  }, [navigation, activeChatId, chromeRevealed, newChatEntry]);

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
  const [localSends, setLocalSends] = useState<Map<object, LocalSend>>(() => new Map());
  // Sticky until eve publishes an assistant row — survives clearing localSend
  // on deliveryId so Thinking does not blank mid-send.
  const [expectingAssistantByStore, setExpectingAssistantByStore] = useState(
    () => new Map<object, boolean>(),
  );
  const localSend = localSends.get(store) ?? null;
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
  const conversation = useMemo(
    () => ({ messages, agents }),
    [messages, agents],
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
  const isRunning = isBusy || Boolean(lastAssistantStreaming);
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
    const projected = projectSendMessages(
      toThreadMessages({ messages }, { isRunning, hasError }),
      messages,
      confirmed ? null : hasError && localSend
        ? { ...localSend, phase: "uncertain" }
        : localSend,
    );
    const base = withPendingAssistant(
      projected as Parameters<typeof withPendingAssistant>[0],
      messages,
      isRunning,
      awaitingReply,
    );
    const withLive = applyLiveReplyOverlay(
      base as Parameters<typeof applyLiveReplyOverlay>[0],
    );
    return appendSpokenTurnMessages(
      withLive as ThreadMessageLike[],
      pendingSpoken,
    );
  }, [
    messages,
    localSend,
    confirmed,
    isRunning,
    hasError,
    awaitingReply,
    pendingSpoken,
    liveReplyVersion,
  ]);

  const hitlDebugKey = useRef("");
  useEffect(() => {
    const last = messages[messages.length - 1];
    const partSummary =
      last?.role === "assistant"
        ? last.parts.map((part) => {
            if (part.type === "tool") {
              const input = part.state === "streaming" ? undefined : part.input;
              const inputOptions =
                input &&
                typeof input === "object" &&
                !Array.isArray(input) &&
                Array.isArray((input as { options?: unknown }).options)
                  ? (input as { options: readonly unknown[] }).options.length
                  : 0;
              const request = part.interaction?.request;
              return {
                type: "tool" as const,
                name: part.name,
                state: part.state,
                interactionStatus: part.interaction?.status ?? null,
                kind: request?.kind ?? null,
                display: request?.display ?? null,
                optionCount: request?.options?.length ?? 0,
                allowFreeform: request?.allowFreeform ?? null,
                inputOptionCount: inputOptions,
              };
            }
            if (part.type === "interaction") {
              return {
                type: "interaction" as const,
                status: part.status,
                kind: part.request.kind,
                display: part.request.display ?? null,
                optionCount: part.request.options?.length ?? 0,
                allowFreeform: part.request.allowFreeform ?? null,
                callName: part.call?.name ?? null,
              };
            }
            return { type: part.type };
          })
        : [];
    const openEvents: {
      kind: string | null;
      display: string | null;
      optionCount: number;
      allowFreeform: boolean | null;
      hasOrigin: boolean;
    }[] = [];
    const openById = new Map<string, (typeof openEvents)[number]>();
    for (const event of events) {
      if (event.type === "interaction.opened") {
        const request = event.data.request;
        openById.set(event.data.interactionId, {
          kind: request.kind ?? null,
          display: request.display ?? null,
          optionCount: request.options?.length ?? 0,
          allowFreeform: request.allowFreeform ?? null,
          hasOrigin: event.data.origin != null,
        });
        continue;
      }
      if (event.type === "interaction.settled") {
        openById.delete(event.data.interactionId);
        continue;
      }
      if (event.type === "turn.settled" || event.type === "session.ended") {
        openById.clear();
      }
    }
    openEvents.push(...openById.values());
    const agentSummary = agents
      ? Object.values(agents).map((agent) => ({
          name: agent.name,
          observation: agent.observation.status,
        }))
      : [];
    const projectedLast = projectedMessages[projectedMessages.length - 1];
    const projectedContent = Array.isArray(projectedLast?.content)
      ? projectedLast.content
      : [];
    const projectedTools = projectedContent
      .filter((part) => part.type === "tool-call")
      .map((part) => ({
        toolName: part.toolName,
        approvalDisplay:
          part.type === "tool-call" ? (part.approval?.display ?? null) : null,
        optionCount:
          part.type === "tool-call" ? (part.approval?.options?.length ?? 0) : 0,
      }));
    const snapshot = {
      storeStatus: status,
      isRunning,
      isBusy,
      waitKind,
      composerBlocked,
      onlyTextQuestionsPending,
      waitingKind: waitingAction?.kind ?? null,
      lastRole: last?.role ?? null,
      lastMetaStatus: last?.metadata?.status ?? null,
      projectedStatus: projectedLast?.status ?? null,
      pending: pendingApprovals.map((item) => ({
        kind: item.kind,
        display: item.display,
        optionCount: item.options.length,
        toolName: item.toolName,
        allowFreeform: item.allowFreeform,
      })),
      parts: partSummary,
      openEvents,
      agents: agentSummary,
      projectedTools,
    };
    const interesting =
      snapshot.pending.length > 0 ||
      snapshot.openEvents.length > 0 ||
      snapshot.waitKind != null ||
      snapshot.waitingKind != null ||
      partSummary.some(
        (part) => part.type === "tool" || part.type === "interaction",
      );
    if (!interesting) return;
    const key = JSON.stringify(snapshot);
    if (hitlDebugKey.current === key) return;
    hitlDebugKey.current = key;
    // #region agent log
    console.log("[hitl-debug]", JSON.stringify(snapshot));
    fetch("http://127.0.0.1:7561/ingest/a354f76e-2698-4aab-9f65-8b6f93041cc1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "daf783",
      },
      body: JSON.stringify({
        sessionId: "daf783",
        runId: "pre-fix",
        hypothesisId: "H1-H5",
        location: "mobile/components/chat-screen.tsx:waitingAction",
        message: "HITL wait classification",
        data: snapshot,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [
    agents,
    composerBlocked,
    events,
    isBusy,
    isRunning,
    messages,
    onlyTextQuestionsPending,
    pendingApprovals,
    projectedMessages,
    status,
    waitKind,
    waitingAction,
  ]);

  useEffect(() => {
    if (!expectingAssistant) return;
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
  }, [expectingAssistant, messages, store, localSend, isBusy]);

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
    recoverDeadSession,
    ensureProjectForPlanMode,
    setActiveProjectId,
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
      recoverDeadSession,
      ensureProjectForPlanMode,
      setActiveProjectId,
    };
  });

  const adapter = useMemo(
    () => ({
      messages: projectedMessages,
      // Return the projection as-is: the runtime's converter assigns stable
      // positional fallback ids (the projection omits ids on purpose) and
      // honors the per-message status it carries.
      convertMessage: (message: ThreadMessageLike) => message,
      isRunning,
      isDisabled: status === "resuming",
      // HITL, in-flight prepare, or unconfirmed prior turn — don't invite a throw.
      isSendDisabled: composerBlocked || unresolvedSend,
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
        // Match an attachment-only pending row to this exact eve receive event
        // after a force-quit. The token is just a correlation label, not auth.
        const outgoing = !turn.text.trim() && Array.isArray(turn.message)
          ? [{ type: "text" as const, text: createAttachmentMarker() }, ...turn.message]
          : turn.message;
        // Paint the user turn before the durable marker's network round-trip.
        // This row is display-only; Eve still waits for prepareSend to persist it.
        const preview = createLocalSend(
          activeStore,
          activeStore.snapshot.messages.length,
          activeStore.snapshot.events.length,
          message,
          outgoing,
        );
        setLocalSends((current) => new Map(current).set(activeStore, preview));
        setExpectingAssistantByStore((current) => new Map(current).set(activeStore, true));
        // Light tick as the bubble appears; skip validation failures above.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const sendPayload = {
          message: outgoing,
          clientContext: buildTurnClientContext(projectIdForTurn, ctx.activeChatId, ctx.activeCustomAgentId),
        };
        try {
          // Mode, project, and model ride the turn as ephemeral clientContext.
          // send() resolves with a Delivery once the server accepts the turn.
          let delivery = await activeStore.send(sendPayload);
          // Dead eve session: start a fresh session on the same chat and retry once.
          if (
            isEveSessionInactive(activeStore.snapshot.error) &&
            ctx.recoverDeadSession(activeStore)
          ) {
            delivery = await activeStore.send(sendPayload);
          }
          // Eve reports prepareSend failures through error/onError, not by
          // rejecting send(). Nothing went to Eve if the durable mark failed.
          if (shouldRestoreUnsentDraft(activeStore.snapshot.error, ctx.wasSendPrepared(activeStore))) {
            throw new Error("Pending message was not saved.");
          }
          const accepted =
            Boolean(delivery?.deliveryId) ||
            hasConfirmedSend(activeStore.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(activeStore)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(activeStore);
            else next.set(activeStore, { ...preview, phase: "uncertain" });
            return next;
          });
          if (accepted) {
            // deliveryId can arrive before delivery.consumed; clear pending so
            // a follow-up is not blocked by the stale prepareSend marker.
            ctx.clearPendingMessage(activeStore);
            if (isAnonymous) void refreshGuestGate();
            void import("@/src/pending-attachments").then(
              ({ clearPendingAttachments, chatAttachmentKey }) => {
                clearPendingAttachments(chatAttachmentKey(ctx.activeChatId));
              },
            );
          } else {
            setSendError({
              store: activeStore,
              message:
                "Couldn't confirm delivery. Your message is still here — resend when you're ready.",
            });
          }
        } catch (cause) {
          if (
            (isEveSessionInactive(cause) ||
              isEveSessionInactive(activeStore.snapshot.error)) &&
            ctx.recoverDeadSession(activeStore)
          ) {
            try {
              const delivery = await activeStore.send(sendPayload);
              if (shouldRestoreUnsentDraft(activeStore.snapshot.error, ctx.wasSendPrepared(activeStore))) {
                throw new Error("Pending message was not saved.");
              }
              const accepted =
                Boolean(delivery?.deliveryId) ||
                hasConfirmedSend(activeStore.snapshot.events, preview);
              setLocalSends((current) => {
                if (current.get(activeStore)?.preview !== preview.preview) return current;
                const next = new Map(current);
                if (accepted) next.delete(activeStore);
                else next.set(activeStore, { ...preview, phase: "uncertain" });
                return next;
              });
              if (accepted) {
                ctx.clearPendingMessage(activeStore);
                void import("@/src/pending-attachments").then(
                  ({ clearPendingAttachments, chatAttachmentKey }) => {
                    clearPendingAttachments(chatAttachmentKey(ctx.activeChatId));
                  },
                );
                return;
              }
            } catch {
              // Fall through to the normal uncertain-delivery path.
            }
          }
          if (!ctx.wasSendPrepared(activeStore)) {
            setLocalSends((current) => {
              if (current.get(activeStore)?.preview !== preview.preview) return current;
              const next = new Map(current);
              next.delete(activeStore);
              return next;
            });
            setExpectingAssistantByStore((current) => {
              if (!current.has(activeStore)) return current;
              const next = new Map(current);
              next.delete(activeStore);
              return next;
            });
            const reason =
              "Couldn't save before sending. Your message is still in the composer.";
            setSendError({ store: activeStore, message: reason });
            throw new MessageNotSentError(reason);
          }
          // After the durable mark, only delivery.consumed proves acceptance.
          // A transport error without it is ambiguous; never resend automatically.
          const accepted = hasConfirmedSend(activeStore.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(activeStore)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(activeStore);
            else next.set(activeStore, { ...preview, phase: "uncertain" });
            return next;
          });
          if (accepted) {
            ctx.clearPendingMessage(activeStore);
          } else {
            setSendError({
              store: activeStore,
              message:
                "Connection dropped before delivery was confirmed. Your message is still here — resend when you're ready.",
            });
          }
          throw cause;
        }
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
        await ctx.store.send({
          answers: [
            {
              interactionId: response.approvalId,
              ...(optionId !== undefined ? { optionId } : {}),
              ...(response.text !== undefined ? { text: response.text } : {}),
            },
          ],
          clientContext: buildTurnClientContext(ctx.activeProjectId, ctx.activeChatId, ctx.activeCustomAgentId),
        });
      },
    }),
    // Rebuild only when the thread snapshot the runtime compares changes.
    [
      projectedMessages,
      isRunning,
      status,
      composerBlocked,
      unresolvedSend,
      needsSignup,
      isAnonymous,
      refreshGuestGate,
    ],
  );

  // Carry out (and similar) creates a chat with a durable pending marker but no
  // eve receive yet. Auto-send once when the thread is empty — never retry
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
    if (autoSentPendingFor.current === activeChatId) return;
    autoSentPendingFor.current = activeChatId;
    void store.send({
      message: pendingMessage,
      clientContext: buildTurnClientContext(activeProjectId, activeChatId, activeCustomAgent?.id),
    });
  }, [pendingMessage, activeChatId, status, store, activeProjectId]);

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
    setExpectingAssistantByStore((current) => new Map(current).set(store, true));
    try {
      if (
        isEveSessionInactive(store.snapshot.error) &&
        recoverDeadSession(store)
      ) {
        // Fresh session on the same chat, then fall through to send.
      }
      const delivery = await store.send({
        // Outgoing was built by toEveTurn for this same store.send shape.
        message: payload as never,
        clientContext: buildTurnClientContext(activeProjectId, activeChatId, activeCustomAgent?.id),
      });
      const accepted =
        Boolean(delivery?.deliveryId) ||
        hasConfirmedSend(store.snapshot.events, pending);
      setLocalSends((current) => {
        const row = current.get(store);
        if (!row) return current;
        const next = new Map(current);
        if (accepted) next.delete(store);
        else next.set(store, { ...row, phase: "uncertain" });
        return next;
      });
      if (accepted) {
        clearPendingMessage(store);
      } else {
        setSendError({
          store,
          message:
            "Still couldn't confirm delivery. Your message is kept — try Resend again.",
        });
      }
    } catch {
      setLocalSends((current) => {
        const row = current.get(store);
        if (!row) return current;
        return new Map(current).set(store, { ...row, phase: "uncertain" });
      });
      setExpectingAssistantByStore((current) => {
        if (!current.has(store)) return current;
        const next = new Map(current);
        next.delete(store);
        return next;
      });
      setSendError({
        store,
        message:
          "Couldn't reach Pearl. Your message is still here — tap Resend when the connection is back.",
      });
    }
  }, [store, localSend, activeProjectId, recoverDeadSession, clearPendingMessage]);

  const runtime = useExternalStoreRuntime(adapter);
  const hasLoadedHistory =
    store.snapshot.events.length > 0 ||
    store.snapshot.messages.length > 0 ||
    Boolean(store.snapshot.session);
  const canResend =
    Boolean(localSend?.outgoing) &&
    (localSend?.phase === "uncertain" ||
      (sendError?.store === store && localSend != null));
  const notice = persistenceError
    ? {
        text: "Could not save this chat.",
        actionLabel: "Retry save",
        onAction: () => void retrySync(),
      }
    : canResend
      ? {
          text:
            sendError?.store === store
              ? sendError.message
              : "Couldn't confirm delivery. Your message is still here.",
          actionLabel: "Resend",
          onAction: () => void resendStoredMessage(),
        }
      : sendPreparing
        ? { text: "Still sending your last message…" }
        : sendError?.store === store
          ? { text: sendError.message }
          : pendingMessage && !localSend && !hasLoadedHistory
            ? {
                text: "Couldn't confirm delivery. Open this chat again when you're online.",
              }
            : hasError && !localSend
              ? {
                  text: "Connection lost while Pearl was replying. Your last message was saved — send a follow-up when you're ready.",
                }
              : null;

  const toggleComputer = useCallback(() => {
    if (computerOpen) dismissComputer();
    else presentComputer();
  }, [computerOpen, dismissComputer, presentComputer]);
  const openCompose = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissComputer();
    newChat();
  }, [dismissComputer, newChat]);
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
  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerBackButtonDisplayMode: "minimal",
          // Thread content draws under the bar and pads itself so the first
          // message rests below the nav; scrolling can fade under it.
          headerTransparent: Platform.OS === "ios",
          headerStyle: Platform.OS === "web" ? { backgroundColor } : undefined,
          // Native needs this too — without it the system back item can flash
          // the default (light) tint for a frame on push.
          headerTintColor: foregroundColor,
          headerTitleStyle:
            Platform.OS === "web" ? { color: foregroundColor } : undefined,
          headerTitle: () => (
            <ThreadIdentityMenu
              name={activeCustomAgent?.name ?? "Pearl"}
              accent={activeCustomAgent?.accent ?? PEARL_IDENTITY_ACCENT}
              markShape={activeCustomAgent?.markShape}
              markTalk={activeCustomAgent?.markTalk}
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
          headerRight:
            Platform.OS === "web"
              ? () => (
                  <View className="flex-row items-center">
                    {activeChatId ? (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="New chat"
                          className="h-10 w-10 items-center justify-center"
                          onPress={openCompose}
                        >
                          <Icon
                            as={SquarePenIcon}
                            className="size-5 text-foreground"
                          />
                        </Pressable>
                        {activeCustomAgent ? null : (
                          <>
                            <View className="w-2" />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Computer"
                              accessibilityState={{ selected: computerOpen }}
                              className="h-10 w-10 items-center justify-center"
                              onPress={toggleComputer}
                            >
                              <Icon
                                as={MonitorIcon}
                                className={
                                  computerOpen
                                    ? "size-5 text-foreground"
                                    : "size-5 text-muted-foreground"
                                }
                              />
                            </Pressable>
                          </>
                        )}
                      </>
                    ) : null}
                  </View>
                )
              : undefined,
        }}
      />
      {Platform.OS !== "web" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="square.and.pencil"
            accessibilityLabel="New chat"
            onPress={openCompose}
            tintColor={foregroundColor}
            separateBackground
            hidden={!activeChatId}
          />
          <Stack.Toolbar.Spacer
            width={8}
            hidden={!activeChatId || Boolean(activeCustomAgent)}
          />
          <Stack.Toolbar.Button
            icon="desktopcomputer"
            accessibilityLabel="Computer"
            selected={computerOpen}
            onPress={toggleComputer}
            tintColor={foregroundColor}
            hidden={!activeChatId || Boolean(activeCustomAgent)}
          />
        </Stack.Toolbar>
      ) : null}
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
                    <Thread
                      autoFocus={
                        Platform.OS === "ios" &&
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
    </StackScreen>
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
