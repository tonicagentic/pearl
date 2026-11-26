import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  SessionStore,
  type ClientSessionState,
  type SessionStreamEvent,
} from "eve/client";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  getRemoteAgentSelection,
  setRemoteAgentSelection,
} from "./remote-agent-selection";
import { setChatRemoteAgent } from "./connected-agents-client";
import { beginStreamTrace, traceStream } from "./stream-trace";
import {
  clearLiveReplyText,
  pushLiveReplyDelta,
  reconcileLiveReplyWithSnapshot,
  seedLiveReplyParts,
} from "./live-reply-text";
import { pendingMessageLabel, hasPendingAction } from "./message-projection";
import type { LiveSpokenDraft, SpokenTurn } from "../../lib/chat/spoken-turns";
import {
  appendChatEvents,
  attachChatToProject,
  checkSendLimit,
  createChat,
  deleteChat as deleteChatRequest,
  getChat,
  listChats,
  markChatRead,
  markPendingChatMessage,
  renameChat as renameChatRequest,
  saveChatSession,
  saveChatSnapshot,
  saveSpokenTurns as saveSpokenTurnsRequest,
  setChatProject as setChatProjectRequest,
  type ActiveChat,
  type ChatListItem,
  type ChatPresence,
  type CustomAgentRef,
} from "./chats-client";
import {
  ensureObservation,
  releaseObservation,
  syncObservationToView,
} from "./chat/observe-lifecycle";
import { enrichPrepareSendPayload } from "./chat/prepare-send";
import { mobileSessionStoreOptions } from "./chat/session-store-options";
import { mergeEventsForSnapshot } from "../../lib/chat/eve-session-recovery";
import { repairSessionHydration } from "../../lib/chat/hydration-prefix";
import { chatListNeedsPresencePoll } from "../../lib/chat/presence-poll";
import { snapStreamingReveal } from "../../lib/streaming-text-reveal";
import { waitingLabelForText } from "../../lib/pearl-lane";
import { setWaitingLabel } from "../../lib/waiting-label";
import { useAuth } from "./auth";
import {
  appendChatListPage,
  applyChatListPage,
  applyChatMeta,
  applyChatPresence,
  isCurrentGeneration,
} from "./chat-list-reducer";
import { useNetworkStatus } from "./network-status";
import { reconnectSession } from "./session-reconnect";
import {
  collapseHeldDeltas,
  flushCatchUpHold,
  routeCatchUpDelta,
  shouldClearCatchUpOnEvent,
  shouldKeepBackgroundSubscription,
  shouldKeepPendingDraft,
  type HeldDelta,
} from "./chat/catch-up";

/** Keep this many recently opened SessionStores warm for instant re-open. */
const RETAINED_STORE_LIMIT = 10;
/** Silent presence / list backstop while any row is working/waiting/unread. */
const PRESENCE_POLL_MS = 1_500;
/** Slow backstop when every Recents row is idle (push + foreground cover the rest). */
const IDLE_POLL_MS = 30_000;

/** True when newly appended events can open or close a person-wait. */
function eventsMayChangeWait(
  previous: readonly unknown[],
  next: readonly unknown[],
): boolean {
  if (next === previous) return false;
  if (next.length < previous.length) return true;
  for (let i = previous.length; i < next.length; i += 1) {
    const type = (next[i] as { readonly type?: string } | undefined)?.type;
    if (
      typeof type === "string" &&
      (type.startsWith("interaction.") ||
        type.startsWith("tool.") ||
        type === "turn.settled" ||
        type === "session.ended")
    ) {
      return true;
    }
  }
  return false;
}

type ChatListContextValue = {
  readonly chats: readonly ChatListItem[];
  readonly chatsLoading: boolean;
  /** True after the first history fetch settles, even if the list mounts later. */
  readonly chatsReady: boolean;
  readonly chatsError: string | null;
  readonly hasMoreChats: boolean;
  readonly loadMoreChats: () => Promise<void>;
  /**
   * Refresh the first page of Recents. Pass `{ silent: true }` for polls and
   * post-snapshot refreshes so the list does not flash loading and pages
   * already loaded via loadMore stay in memory.
   */
  readonly reloadChats: (options?: { readonly silent?: boolean }) => Promise<void>;
  /** Patch one Recents row from a silent presence push (or live store). */
  readonly patchChatPresence: (
    chatId: string,
    presence: ChatPresence,
    updatedAt?: string,
  ) => void;
  /** Patch title / updatedAt after a quick-path answer (no presence invent). */
  readonly patchChatMeta: (
    chatId: string,
    meta: { readonly title?: string; readonly updatedAt?: string },
  ) => void;
  /** Delete a stored chat; opens a new chat when the deleted id is active. */
  readonly deleteChat: (chatId: string) => Promise<void>;
  /** Rename a stored chat and refresh local list / active title. */
  readonly renameChat: (chatId: string, title: string) => Promise<void>;
  /** Attach or detach a chat from a project; updates list + active binding. */
  readonly setChatProject: (
    chatId: string,
    projectId: string | null,
  ) => Promise<void>;
};

type ActiveChatContextValue = {
  /** The active eve store (one React-mounted store; others may be LRU-retained). */
  readonly store: SessionStore;
  /**
   * Synchronous active store (ref). Use after `selectChat` / `createChat` when
   * React state may not have flushed yet — e.g. live voice tool handlers.
   */
  readonly getActiveStore: () => SessionStore;
  /** Synchronous active chat id (ref). */
  readonly getActiveChatId: () => string | null;
  /** Synchronous active custom-agent ref (after `selectChat`). */
  readonly getActiveCustomAgent: () => CustomAgentRef | null;
  readonly activeChatId: string | null;
  /** Project linked to the active chat (Plan mode / project chats). */
  readonly activeProjectId: string | null;
  readonly setActiveProjectId: (projectId: string | null) => void;
  /** User-defined agent for the active durable thread, if any. */
  readonly activeCustomAgent: CustomAgentRef | null;
  readonly setActiveCustomAgent: (agent: CustomAgentRef | null) => void;
  /** Advances only when the user enters a fresh chat, never during a send. */
  readonly newChatEntry: number;
  readonly activeTitle: string;
  /**
   * Reattach an open or retained store (foreground, push, or reopen).
   * Hydrates from the network when the store was evicted.
   */
  readonly resumeChatFromPush: (chatId: string) => void;
  /** Reconnect the given (or active) store to its eve session. */
  readonly reconnect: (source?: SessionStore) => Promise<boolean>;
  /** Open a stored chat (replays its events, attaches its session). */
  readonly selectChat: (chatId: string) => Promise<boolean>;
  readonly selectionError: string | null;
  readonly persistenceError: string | null;
  /** Connection failure after reconnect backoff is exhausted. */
  readonly connectionError: string | null;
  readonly clearConnectionError: () => void;
  /**
   * Clear the one-shot dead-session guard after a replacement session
   * accepts a delivery, so a later expiry can recover again.
   */
  readonly clearSessionRecovery: (source: SessionStore) => void;
  readonly pendingMessage: string | null;
  readonly retrySync: () => Promise<void>;
  /** Whether the durable pending marker completed before this store's send. */
  readonly wasSendPrepared: (source: SessionStore) => boolean;
  /**
   * Drop the in-memory pending marker once send() returns a deliveryId (before
   * delivery.consumed). Matches the delivery.consumed clear so a follow-up
   * send is not blocked by a stale pendingMessage.
   */
  readonly clearPendingMessage: (source: SessionStore) => void;
  /**
   * Archive Pearl events and call `newSession()` once when the eve session is
   * inactive. Returns false if recovery was already attempted for this store.
   */
  readonly recoverDeadSession: (source: SessionStore) => boolean;
  /** Drop the active chat and start fresh (the row is created on first send). */
  readonly newChat: () => void;
  /** Live voice lines shown until eve imports them on the next real send. */
  readonly spokenTurns: readonly SpokenTurn[];
  /** Persist a live call without starting a Pearl turn. */
  readonly saveSpokenTurns: (turns: readonly LiveSpokenDraft[]) => Promise<void>;
  /** Session-free quick-path turns until eve imports them on escalate. */
  readonly quickTurns: readonly SpokenTurn[];
  readonly setQuickTurns: (turns: readonly SpokenTurn[]) => void;
};

type ChatsContextValue = ChatListContextValue & ActiveChatContextValue;

const ChatListContext = createContext<ChatListContextValue | null>(null);
const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

type ChatBinding = {
  id: string | null;
  title: string;
  projectId: string | null;
  remoteAgentId: string | null;
  customAgent: CustomAgentRef | null;
  pendingMessage: string | null;
  sendPrepared: boolean;
  sendStartedAt: number | null;
  eventIndex: number;
  /** Last event count written by a full snapshot; used to skip idle open/resume saves. */
  savedEventCount: number;
  /**
   * Pearl UI events retained across `newSession()` so snapshots cannot wipe
   * history when the live store only holds the new session’s stream.
   */
  archivedEvents: SessionStreamEvent[];
  /** Guards a single seamless dead-session recovery per send attempt. */
  sessionRecoveryAttempted: boolean;
  /** Last time a stream error tried to reattach, so a dead socket cannot loop. */
  streamResumeAt: number;
  /**
   * Text content.deltas held while status is `resuming`. Flushed when resume
   * settles — seeded into the live overlay if the turn is still busy, else dropped.
   */
  catchUpHold: HeldDelta[];
  queue: Promise<void>;
  batch: { event: SessionStreamEvent; eventIndex: number }[];
  timer: ReturnType<typeof setTimeout> | null;
  syncFailed: boolean;
  /** Release SessionStore observation when the store is no longer mounted. */
  stopObserving: (() => void) | null;
};

/** Apply the catch-up flush for a store that just finished resume(). */
function applyCatchUpFlush(store: SessionStore, binding: ChatBinding): void {
  const action = flushCatchUpHold({
    status: store.snapshot.status,
    held: binding.catchUpHold,
  });
  binding.catchUpHold = [];
  if (action.kind !== "seed") return;
  const collapsed = collapseHeldDeltas(action.held);
  seedLiveReplyParts(collapsed);
  snapStreamingReveal();
}

const traceSend = (binding: ChatBinding, stage: string) => {
  if (__DEV__ && binding.sendStartedAt !== null) {
    console.info(`[mobile send] ${stage} +${Math.round(performance.now() - binding.sendStartedAt)}ms`);
  }
};

/** A store keeps its own chat identity even while another chat is selected. */
export function ChatsProvider({ children }: { readonly children: ReactNode }) {
  const { signedIn } = useAuth();
  const { offline } = useNetworkStatus();
  const wasOfflineRef = useRef(offline);
  const activeChatIdRef = useRef<string | null>(null);
  const selectionGeneration = useRef(0);
  const listGeneration = useRef(0);
  const loadMoreInFlight = useRef(false);
  const [bindings] = useState(() => new WeakMap<SessionStore, ChatBinding>());
  // LRU of hydrated stores (Map insertion order = oldest → newest). Reselecting
  // a retained id must not create a second writer for the same chat.
  const [retainedStores] = useState(() => new Map<string, SessionStore>());
  const activeStoreRef = useRef<SessionStore | null>(null);
  /** Unsubscribe helpers for background working observers (warm transcript sync). */
  const backgroundPresenceUnsubs = useRef(
    new Map<SessionStore, () => void>(),
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const [activeCustomAgent, setActiveCustomAgentState] =
    useState<CustomAgentRef | null>(null);
  const activeCustomAgentRef = useRef<CustomAgentRef | null>(null);
  const [newChatEntry, setNewChatEntry] = useState(0);
  const [activeTitle, setActiveTitle] = useState("New chat");
  const [chats, setChats] = useState<readonly ChatListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsReady, setChatsReady] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [spokenTurns, setSpokenTurns] = useState<readonly SpokenTurn[]>([]);
  const [quickTurns, setQuickTurns] = useState<readonly SpokenTurn[]>([]);

  const setActiveCustomAgent = useCallback((agent: CustomAgentRef | null) => {
    activeCustomAgentRef.current = agent;
    setActiveCustomAgentState(agent);
    const store = activeStoreRef.current;
    if (store) {
      const binding = bindings.get(store);
      if (binding) binding.customAgent = agent;
    }
  }, [bindings]);

  const setActiveProjectId = useCallback((projectId: string | null) => {
    activeProjectIdRef.current = projectId;
    setActiveProjectIdState(projectId);
    const store = activeStoreRef.current;
    if (store) {
      const binding = bindings.get(store);
      if (binding) binding.projectId = projectId;
    }
  }, [bindings]);

  const releaseRetainedStore = useCallback(
    (chatId: string, candidate: SessionStore) => {
      const binding = bindings.get(candidate);
      binding?.stopObserving?.();
      if (binding) binding.stopObserving = null;
      if (retainedStores.get(chatId) === candidate) {
        retainedStores.delete(chatId);
      }
    },
    [bindings, retainedStores],
  );

  /** Drop oldest safe stores until size ≤ RETAINED_STORE_LIMIT (or none are safe). */
  const evictRetainedOverflow = useCallback(() => {
    if (retainedStores.size <= RETAINED_STORE_LIMIT) return;
    for (const [chatId, candidate] of retainedStores) {
      if (activeStoreRef.current === candidate) continue;
      const binding = bindings.get(candidate);
      if (!binding?.id || binding.pendingMessage || binding.syncFailed) {
        continue;
      }
      if (candidate.snapshot.status !== "idle") continue;
      // Sync queue must be quiet; re-check after it settles.
      void binding.queue.then(() => {
        if (retainedStores.size <= RETAINED_STORE_LIMIT) return;
        if (activeStoreRef.current === candidate) return;
        if (binding.pendingMessage || binding.syncFailed) return;
        if (candidate.snapshot.status !== "idle") return;
        if (retainedStores.get(chatId) !== candidate) return;
        releaseRetainedStore(chatId, candidate);
        evictRetainedOverflow();
      });
      // One async candidate at a time (oldest safe); recurse after settle.
      return;
    }
    // Nothing safe to drop — leave size > limit until a later idle finish.
  }, [bindings, retainedStores, releaseRetainedStore]);

  /** Mark chatId as most-recently used and evict overflow if needed. */
  const touchRetained = useCallback(
    (chatId: string, next: SessionStore) => {
      const previous = retainedStores.get(chatId);
      retainedStores.delete(chatId);
      if (previous && previous !== next) {
        const binding = bindings.get(previous);
        binding?.stopObserving?.();
        if (binding) binding.stopObserving = null;
      }
      retainedStores.set(chatId, next);
      evictRetainedOverflow();
    },
    [bindings, retainedStores, evictRetainedOverflow],
  );

  const buildStore = useCallback((chat: ActiveChat | null) => {
    // Hydrate from saved events so reopening paints the transcript immediately
    // (same as web). resume() then only catches up past that prefix — without
    // initialEvents, resume replayed history live and paced word-by-word.
    // Repair a prefix that was stored out of stream order so a later
    // turn.paused cannot hide the transcript or skip the interaction line.
    const repaired = repairSessionHydration(
      chat?.events ?? [],
      (chat?.session as ClientSessionState | null | undefined) ?? null,
    );
    const initialSession = chat?.session
      ? {
          ...(chat.session as ClientSessionState),
          streamIndex:
            repaired.streamIndex ??
            (chat.session as ClientSessionState).streamIndex,
        }
      : undefined;
    const store = new SessionStore(
      mobileSessionStoreOptions({
        baseUrl: AGENT_URL,
        headers: () => {
          const credential = getAuthCookie();
          return credential
            ? { authorization: `Bearer ${credential}` }
            : ({} as Record<string, string>);
        },
        ...(repaired.events.length ? { initialEvents: repaired.events } : {}),
        ...(initialSession ? { initialSession } : {}),
      }),
    );
    bindings.set(store, {
      id: chat?.id ?? null,
      title: chat?.title ?? "New chat",
      projectId: chat?.projectId ?? null,
      remoteAgentId: chat?.remoteAgentId ?? null,
      customAgent: chat?.customAgent ?? null,
      pendingMessage: chat?.pendingUserMessage ?? null,
      sendPrepared: false,
      sendStartedAt: null,
      eventIndex: chat?.events.length ?? 0,
      savedEventCount: repaired.events.length,
      archivedEvents: [...repaired.events],
      sessionRecoveryAttempted: false,
      streamResumeAt: 0,
      catchUpHold: [],
      queue: Promise.resolve(),
      batch: [],
      timer: null,
      syncFailed: false,
      stopObserving: null,
    });
    if (chat) touchRetained(chat.id, store);
    return store;
  }, [bindings, touchRetained]);

  const reloadChats = useCallback(async (options?: { readonly silent?: boolean }) => {
    const silent = options?.silent === true;
    const stamp = ++listGeneration.current;
    if (!silent) setChatsLoading(true);

    try {
      const page = await listChats(null);
      if (!isCurrentGeneration(stamp, listGeneration.current)) return;
      setChats((current) =>
        applyChatListPage({
          current,
          page: page.chats,
          silent,
        }),
      );
      // Only reset the cursor on a full replace; silent merges keep pagination.
      if (!silent) {
        setCursor(page.nextCursor);
      } else {
        setCursor((current) => current ?? page.nextCursor);
      }
      setChatsError(null);
    } catch {
      if (!isCurrentGeneration(stamp, listGeneration.current)) return;
      // Preserve the last successful list but expose the offline state.
      setChatsError("Could not load history. Check your connection and retry.");
    } finally {
      if (isCurrentGeneration(stamp, listGeneration.current)) {
        if (!silent) setChatsLoading(false);
        // The chats list can mount after this fetch (billing gate). A loading
        // edge the list itself never saw must not keep the empty state hidden.
        setChatsReady(true);
      }
    }
  }, []);

  const loadMoreChats = useCallback(async () => {
    if (!cursor || loadMoreInFlight.current) {
      return;
    }

    loadMoreInFlight.current = true;
    setChatsLoading(true);

    try {
      const page = await listChats(cursor);
      setChats((current) => appendChatListPage(current, page.chats));
      setCursor(page.nextCursor);
      setChatsError(null);
    } catch {
      setChatsError("Could not load more chats. Tap Load more to retry.");
    } finally {
      loadMoreInFlight.current = false;
      setChatsLoading(false);
    }
  }, [cursor]);

  // One store per active chat; rebuilt only when the selection changes.
  const [store, setStore] = useState(() => buildStore(null));

  /** After switching away from a store, only trim the LRU if over capacity. */
  const pruneIdleStore = useCallback((_prior: SessionStore | null) => {
    evictRetainedOverflow();
  }, [evictRetainedOverflow]);

  const patchChatPresence = useCallback(
    (
      chatId: string,
      presence: ChatPresence,
      updatedAt?: string,
    ) => {
      setChats((current) =>
        applyChatPresence(current, chatId, presence, updatedAt),
      );
    },
    [],
  );

  const patchChatMeta = useCallback(
    (
      chatId: string,
      meta: { readonly title?: string; readonly updatedAt?: string },
    ) => {
      if (meta.title && activeChatIdRef.current === chatId) {
        setActiveTitle(meta.title);
      }
      const retained = retainedStores.get(chatId);
      if (retained && meta.title) {
        const binding = bindings.get(retained);
        if (binding) binding.title = meta.title;
      }
      setChats((current) => applyChatMeta(current, chatId, meta));
    },
    [bindings, retainedStores],
  );

  const markActiveChatRead = useCallback((chatId: string) => {
    // Optimistic: opening clears unread; waiting/working stay visible.
    // Callers with a live session wait until resume() settles so the unseen
    // message has painted before the row loses its unread mark.
    setChats((current) => {
      const index = current.findIndex((chat) => chat.id === chatId);
      if (index < 0) return current;
      const existing = current[index]!;
      if (existing.presence !== "unread") return current;
      const next = [...current];
      next[index] = {
        ...existing,
        presence: "idle",
        waitingForInput: false,
      };
      return next;
    });
    void markChatRead(chatId).catch(() => {
      // List will reconcile on the next reload.
    });
  }, []);

  // Each callback closes over its own binding. A stream finishing after a chat
  // switch must NEVER write its events into the newly selected chat.
  useEffect(() => {
    const binding = bindings.get(store)!;
    activeStoreRef.current = store;
    const reportFailure = () => {
      binding.syncFailed = true;
      if (activeStoreRef.current === store) setPersistenceError("Save failed");
    };
    const enqueue = (work: () => Promise<void>) => {
      binding.queue = binding.queue.then(work).catch(reportFailure);
    };
    const flush = () => {
      if (binding.timer) clearTimeout(binding.timer);
      binding.timer = null;
      const batch = binding.batch.splice(0);
      if (binding.id && batch.length > 0) {
        const id = binding.id;
        enqueue(() => appendChatEvents(id, batch));
      }
    };

    // Hold observe while a turn is open; release when settled so child
    // AgentStreamFollower does not keep catch-up-polling (followWhile alone
    // closes only the root stream while observe() is held).
    ensureObservation(binding, () => store.observe());
    const syncObs = () =>
      syncObservationToView(binding, store.snapshot.view, () => store.observe());
    store.setCallbacks({
      onEvent: (event) => {
        if (event.type === "content.delta") {
          const data = event.data as {
            readonly delta?: unknown;
            readonly partId?: unknown;
            readonly kind?: unknown;
          };
          const delta = data.delta;
          if (typeof delta === "string") {
            traceStream("delta", delta.length);
            if (typeof data.partId === "string") {
              const kind =
                typeof data.kind === "string" ? data.kind : undefined;
              const turnId =
                typeof event.scope?.turnId === "string"
                  ? event.scope.turnId
                  : undefined;
              const route = routeCatchUpDelta({
                status: store.snapshot.status,
                kind,
              });
              if (route.kind === "hold") {
                binding.catchUpHold.push({
                  turnId,
                  partId: data.partId,
                  kind,
                  delta,
                });
              } else if (route.kind === "push") {
                pushLiveReplyDelta({
                  turnId,
                  partId: data.partId,
                  kind,
                  delta,
                });
              }
            }
          }
        } else if (event.type === "turn.settled") {
          // Do not clear the live overlay on a completed settle — the snapshot
          // may still lag endOfLine commits. Failed / cancelled settles and
          // session.ended drop the catch-up hold and live buffer so a dead
          // turn does not keep pacing.
          const outcome =
            typeof (event.data as { outcome?: unknown }).outcome === "string"
              ? (event.data as { outcome: string }).outcome
              : undefined;
          if (shouldClearCatchUpOnEvent({ type: event.type, outcome })) {
            binding.catchUpHold = [];
            clearLiveReplyText();
          }
          syncObs();
          traceStream("settled");
        } else if (event.type === "session.ended") {
          binding.catchUpHold = [];
          clearLiveReplyText();
          syncObs();
        }
        if (!binding.id) return;
        binding.batch.push({ event, eventIndex: binding.eventIndex++ });
        if (event.type === "delivery.consumed") {
          traceSend(binding, "eve accepted");
          binding.pendingMessage = null;
          if (activeStoreRef.current === store) setPendingMessage(null);
        }
        if (binding.batch.length >= 20) flush();
        else if (!binding.timer) binding.timer = setTimeout(flush, 250);
      },
      onSessionChange: (session) => {
        flush();
        if (binding.id && session) {
          const id = binding.id;
          // Keep session cursor saves queued even after a snapshot failure so
          // the next cold resume does not attach at a stale line.
          enqueue(() => saveChatSession(id, session));
        }
      },
      onFinish: (snapshot) => {
        syncObs();
        flush();
        if (binding.pendingMessage && activeStoreRef.current === store) {
          setPendingMessage(binding.pendingMessage);
        }
        if (!binding.id || binding.pendingMessage) return;
        const id = binding.id;
        const events = mergeEventsForSnapshot(
          binding.archivedEvents,
          snapshot.events,
        );
        // eve fires onFinish on mount/resume even when nothing new arrived.
        // Skip the snapshot so idle opens do not bump Recents order.
        // Also skip empty post-newSession finishes that would truncate history.
        if (
          snapshot.events.length === 0 ||
          events.length === binding.savedEventCount
        ) {
          // Idle finish may unblock LRU eviction of this (or older) stores.
          evictRetainedOverflow();
          return;
        }
        enqueue(async () => {
          const saved = await saveChatSnapshot(id, events, snapshot.session);
          binding.archivedEvents = [...events];
          binding.savedEventCount = events.length;
          binding.eventIndex = Math.max(binding.eventIndex, events.length);
          if (saved.title) {
            binding.title = saved.title;
            if (activeChatIdRef.current === id) {
              setActiveTitle(saved.title);
            }
            setChats((current) =>
              applyChatMeta(current, id, {
                title: saved.title,
                updatedAt: new Date().toISOString(),
              }),
            );
          }
          traceSend(binding, "snapshot saved");
          binding.syncFailed = false;
          if (activeStoreRef.current === store) setPersistenceError(null);
          // The next turn waits on this queue; history GET must not hold its durable mark.
          void reloadChats({ silent: true });
          // Snapshot settled — retry overflow eviction now that this writer is idle.
          evictRetainedOverflow();
        });
      },
      onError: (_error) => {
        if (activeStoreRef.current === store && binding.pendingMessage) {
          setPendingMessage(binding.pendingMessage);
        }
        // The follow loop already retried transport drops. Landing here means
        // it stopped. Foreground resume is the only other reattach, so a drop
        // while the app stays open leaves the thread quiet. Resume without
        // cancel so a live server turn is not aborted.
        const now = Date.now();
        if (now - binding.streamResumeAt < 5_000) {
          if (activeStoreRef.current === store) {
            setConnectionError("Lost the connection to Pearl.");
          }
          return;
        }
        binding.streamResumeAt = now;
        if (store.snapshot.status === "resuming") return;
        void store.resume().then(
          () => {
            if (activeStoreRef.current === store) {
              applyCatchUpFlush(store, binding);
              setConnectionError(null);
            }
          },
          (_cause: unknown) => {
            if (activeStoreRef.current === store) {
              setConnectionError("Lost the connection to Pearl.");
            }
          },
        );
      },
      prepareSend: async (input) => {
        binding.sendPrepared = false;
        binding.sendStartedAt = performance.now();
        beginStreamTrace("send");
        // Re-attach observation before the turn opens (may have been released
        // after the previous settle so child followers stop polling).
        ensureObservation(binding, () => store.observe());
        // An attachment-only turn uses a safe title/marker. Neither a
        // correlation token nor pasted document text belongs in chat metadata.
        const message = pendingMessageLabel(input.message);
        if (message) setWaitingLabel(waitingLabelForText(message));
        const projectId =
          binding.projectId ?? activeProjectIdRef.current ?? null;
        if (!binding.id) {
          // New chat needs an id before eve can start; keep this await.
          const created = await createChat(message || undefined, projectId);
          binding.id = created.id;
          binding.projectId = created.projectId ?? projectId;
          const remoteAgentId = getRemoteAgentSelection();
          binding.remoteAgentId = remoteAgentId;
          if (remoteAgentId) {
            const bindRemote = () =>
              setChatRemoteAgent(created.id, remoteAgentId);
            void bindRemote().catch(() => {
              void bindRemote().catch(() => {
                // Selection still rides clientContext for this turn.
              });
            });
          }
          if (activeStoreRef.current === store) {
            activeChatIdRef.current = created.id;
            setActiveChatId(created.id);
            setActiveTitle(created.title);
            activeProjectIdRef.current = binding.projectId;
            setActiveProjectIdState(binding.projectId);
          }
          setChats((current) => [
            {
              ...created,
              remoteAgentId,
              waitingForInput: false,
              presence: "idle" as const,
            },
            ...current.filter((chat) => chat.id !== created.id),
          ]);
        } else {
          if (projectId && !binding.projectId) {
            const chatId = binding.id;
            void attachChatToProject(chatId, projectId).then(() => {
              binding.projectId = projectId;
              if (activeStoreRef.current === store) {
                activeProjectIdRef.current = projectId;
                setActiveProjectIdState(projectId);
              }
            });
          }
          if (message) {
            // Do not block model dispatch on the pending mark. Still wait for
            // the prior snapshot queue so a stale clear cannot erase this mark.
            const chatId = binding.id;
            const mark = binding.queue
              .catch(() => undefined)
              .then(() => markPendingChatMessage(chatId, message))
              .catch(() => {
                // Surface via onError paths if the turn also fails; a lone
                // mark failure must not hold the first token.
              });
            void mark;
          }
        }
        binding.pendingMessage = message || null;
        binding.sendPrepared = true;
        // onMessage imports spoken / quick turns for this send; drop overlays.
        if (message && activeStoreRef.current === store) {
          setSpokenTurns([]);
          setQuickTurns([]);
        }
        traceSend(binding, "pending marker saved");
        if (binding.id) touchRetained(binding.id, store);
        return enrichPrepareSendPayload(input, {
          checkSendLimit,
          projectId: binding.projectId ?? projectId,
          chatId: binding.id,
          customAgentId: binding.customAgent?.id ?? activeCustomAgentRef.current?.id ?? null,
        });
      },
    });
    // An attached session can have an unfinished turn after the app was killed.
    // Replaying its durable stream reconciles accepted messages before the user
    // decides whether an unsent message needs resending.
    // Drop any prior background presence watcher — this store is active again.
    const priorBackground = backgroundPresenceUnsubs.current.get(store);
    if (priorBackground) {
      priorBackground();
      backgroundPresenceUnsubs.current.delete(store);
    }

    if (store.snapshot.session) {
      ensureObservation(binding, () => store.observe());
      void store.resume().then(
        () => {
          if (activeStoreRef.current !== store) return;
          applyCatchUpFlush(store, binding);
          syncObs();
          if (binding.id && activeChatIdRef.current === binding.id) {
            markActiveChatRead(binding.id);
          }
        },
        () => {
          // Resume failed — still clear unread so the row is not stuck.
          if (
            activeStoreRef.current === store &&
            binding.id &&
            activeChatIdRef.current === binding.id
          ) {
            markActiveChatRead(binding.id);
          }
        },
      );
    } else if (binding.id && activeChatIdRef.current === binding.id) {
      markActiveChatRead(binding.id);
    }
    return () => {
      flush();
      const stillWorking = shouldKeepBackgroundSubscription({
        status: store.snapshot.status,
        pendingMessage: Boolean(binding.pendingMessage),
      });
      if (stillWorking) {
        // Warm path: keep observe()+callbacks so the transcript keeps syncing
        // while the user is in another chat. Presence also comes from the
        // server mirror + silent push; this is for faster reopen.
        let lastWaiting = hasPendingAction(store.snapshot);
        let lastStatus = store.snapshot.status;
        let lastEvents = store.snapshot.events;
        const stopBackground = store.subscribe(() => {
          if (activeStoreRef.current === store) return;
          const { status, events } = store.snapshot;
          const busy = status === "busy" || status === "resuming";
          const statusChanged = status !== lastStatus;
          lastStatus = status;
          let waiting = lastWaiting;
          if (statusChanged || eventsMayChangeWait(lastEvents, events)) {
            waiting = hasPendingAction(store.snapshot);
            lastWaiting = waiting;
          }
          lastEvents = events;
          const chatId = binding.id;
          if (chatId) {
            // "resuming" is history catch-up, not a live turn. Painting it as
            // working mounts a spinner on the row under the open thread.
            patchChatPresence(
              chatId,
              waiting ? "waiting" : status === "busy" ? "working" : "idle",
            );
          }
          if (busy && !waiting) return;
          if (binding.timer) {
            clearTimeout(binding.timer);
            binding.timer = null;
          }
          const batch = binding.batch.splice(0);
          if (binding.id && batch.length > 0) {
            const id = binding.id;
            enqueue(() => appendChatEvents(id, batch));
          }
          binding.stopObserving?.();
          binding.stopObserving = null;
          backgroundPresenceUnsubs.current.delete(store);
          stopBackground();
        });
        backgroundPresenceUnsubs.current.set(store, stopBackground);
        return;
      }
      binding.stopObserving?.();
      binding.stopObserving = null;
    };
  }, [
    store,
    reloadChats,
    bindings,
    touchRetained,
    evictRetainedOverflow,
    patchChatPresence,
    markActiveChatRead,
  ]);

  const reconnect = useCallback(
    async (source?: SessionStore): Promise<boolean> => {
      const target = source ?? activeStoreRef.current;
      if (!target?.snapshot.session) return true;
      const binding = bindings.get(target);
      if (binding) ensureObservation(binding, () => target.observe());
      const result = await reconnectSession(target);
      if (result.ok) {
        if (activeStoreRef.current === target) {
          if (binding) {
            applyCatchUpFlush(target, binding);
            syncObservationToView(
              binding,
              target.snapshot.view,
              () => target.observe(),
            );
          }
          setConnectionError(null);
        }
        return true;
      }
      if (activeStoreRef.current === target) {
        setConnectionError(result.error);
      }
      return false;
    },
    [bindings],
  );

  // When iOS/Android returns the process to the foreground, reattach every
  // retained store that still has a session (not only busy ones).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") {
        return;
      }
      for (const candidate of [
        activeStoreRef.current,
        ...retainedStores.values(),
      ]) {
        if (!candidate?.snapshot.session) continue;
        void reconnect(candidate);
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => {
      subscription.remove();
    };
  }, [retainedStores, reconnect]);

  const resumeChatFromPush = useCallback(
    (chatId: string) => {
      const candidate =
        (activeChatIdRef.current === chatId
          ? activeStoreRef.current
          : null) ??
        retainedStores.get(chatId) ??
        null;
      if (candidate?.snapshot.session) {
        void reconnect(candidate);
        return;
      }
      // Evicted store: hydrate so presence / HITL can resume without opening.
      void getChat(chatId)
        .then((chat) => {
          if (!chat?.session) return;
          if (retainedStores.has(chatId) || activeChatIdRef.current === chatId) {
            return;
          }
          const next = buildStore(chat);
          void reconnect(next);
        })
        .catch(() => {
          // Presence poll / next open will catch up.
        });
    },
    [retainedStores, reconnect, buildStore],
  );

  const selectChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      const generation = ++selectionGeneration.current;
      if (chatId === activeChatIdRef.current) {
        const active = activeStoreRef.current;
        if (active?.snapshot.session) {
          // Reconnect flushes catch-up; mark read after the gap has painted.
          void reconnect(active).then((ok) => {
            if (ok && activeChatIdRef.current === chatId) {
              markActiveChatRead(chatId);
            }
          });
        } else {
          markActiveChatRead(chatId);
        }
        return true;
      }
      setSelectionError(null);
      const retained = retainedStores.get(chatId);
      if (retained) {
        const prior = activeStoreRef.current;
        const binding = bindings.get(retained)!;
        activeStoreRef.current = retained;
        activeChatIdRef.current = chatId;
        setActiveChatId(chatId);
        setActiveTitle(binding.title);
        activeProjectIdRef.current = binding.projectId;
        setActiveProjectIdState(binding.projectId);
        activeCustomAgentRef.current = binding.customAgent;
        setActiveCustomAgentState(binding.customAgent);
        setRemoteAgentSelection(binding.remoteAgentId);
        // Empty carry-out auto-sends. Pending with history is an unconfirmed
        // send — keep it for the retry ladder; do not auto-send into history.
        const hasHistory =
          Boolean(retained.snapshot.session) ||
          retained.snapshot.events.length > 0 ||
          retained.snapshot.messages.length > 0;
        const hasConsumed = retained.snapshot.events.some(
          (event) => event.type === "delivery.consumed",
        );
        const pending = shouldKeepPendingDraft({
          pendingMessage: binding.pendingMessage,
          hasHistory,
          hasConsumed,
        });
        if (!pending) binding.pendingMessage = null;
        setPendingMessage(pending);
        setSpokenTurns([]);
        setQuickTurns([]);
        setPersistenceError(binding.syncFailed ? "Save failed" : null);
        touchRetained(chatId, retained);
        setStore(retained);
        pruneIdleStore(prior);
        // Sessioned stores mark read after resume in the observe effect.
        if (!retained.snapshot.session) markActiveChatRead(chatId);
        // Retained stores skip a network round-trip; refresh spoken / quick turns.
        void getChat(chatId).then((fresh) => {
          if (activeChatIdRef.current === chatId && fresh) {
            setSpokenTurns(fresh.spokenTurns ?? []);
            setQuickTurns(fresh.quickTurns ?? []);
            binding.customAgent = fresh.customAgent ?? null;
            activeCustomAgentRef.current = fresh.customAgent ?? null;
            setActiveCustomAgentState(fresh.customAgent ?? null);
          }
        });
        return true;
      }
      try {
        const chat = await getChat(chatId);
        if (generation !== selectionGeneration.current) return false;
        if (!chat) {
          setSelectionError("Conversation not found. Reload history and try again.");
          return false;
        }
        const nextStore = buildStore(chat);
        // Empty carry-out chats auto-send. A pending marker with history is
        // an unconfirmed send after a force-quit — keep it for the retry ladder
        // when delivery.consumed is missing; never auto-send into history.
        const hasHistory =
          Boolean(chat.session) || chat.events.length > 0;
        const hasConsumed = chat.events.some(
          (event) => event.type === "delivery.consumed",
        );
        const stillPending = shouldKeepPendingDraft({
          pendingMessage: chat.pendingUserMessage,
          hasHistory,
          hasConsumed,
        });
        bindings.get(nextStore)!.pendingMessage = stillPending;
        const prior = activeStoreRef.current;
        activeStoreRef.current = nextStore;
        activeChatIdRef.current = chat.id;
        setActiveChatId(chat.id);
        setActiveTitle(chat.title);
        activeProjectIdRef.current = chat.projectId ?? null;
        setActiveProjectIdState(chat.projectId ?? null);
        activeCustomAgentRef.current = chat.customAgent ?? null;
        setActiveCustomAgentState(chat.customAgent ?? null);
        setRemoteAgentSelection(chat.remoteAgentId ?? null);
        setPendingMessage(stillPending);
        setSpokenTurns(chat.spokenTurns ?? []);
        setQuickTurns(chat.quickTurns ?? []);
        setPersistenceError(null);
        setStore(nextStore);
        pruneIdleStore(prior);
        // Sessioned stores mark read after resume in the observe effect.
        if (!chat.session) markActiveChatRead(chat.id);
        return true;
      } catch {
        if (generation === selectionGeneration.current) {
          setSelectionError("Could not open conversation. Check your connection and try again.");
        }
        return false;
      }
    },
    [
      buildStore,
      bindings,
      retainedStores,
      touchRetained,
      pruneIdleStore,
      markActiveChatRead,
      reconnect,
    ],
  );

  const newChat = useCallback(() => {
    // New chat only clears local UI + builds a fresh SessionStore. Do not
    // store.end() — the prior server session may still be useful in Recents.
    const priorChatId = activeChatIdRef.current;
    ++selectionGeneration.current;
    activeChatIdRef.current = null;
    setActiveChatId(null);
    activeProjectIdRef.current = null;
    setActiveProjectIdState(null);
    activeCustomAgentRef.current = null;
    setActiveCustomAgentState(null);
    setRemoteAgentSelection(null);
    setNewChatEntry((current) => current + 1);
    setActiveTitle("New chat");
    setPendingMessage(null);
    setSpokenTurns([]);
    setQuickTurns([]);
    setPersistenceError(null);
    setSelectionError(null);
    // Drop durable composer attachments for the prior chat and the draft key.
    void import("./pending-attachments").then(
      ({ clearPendingAttachments, chatAttachmentKey, PENDING_ATTACHMENTS_DRAFT_KEY }) => {
        clearPendingAttachments(chatAttachmentKey(priorChatId));
        clearPendingAttachments(PENDING_ATTACHMENTS_DRAFT_KEY);
      },
    );
    const nextStore = buildStore(null);
    const prior = activeStoreRef.current;
    activeStoreRef.current = nextStore;
    setStore(nextStore);
    pruneIdleStore(prior);
    // Prewarm the empty writer once auth is present (signed-in effect also
    // prewarms; this covers in-session New Chat).
    if (getAuthCookie()) {
      void nextStore.prewarm().catch(() => {});
    }
  }, [buildStore, pruneIdleStore]);

  const saveSpokenTurns = useCallback(
    async (drafts: readonly LiveSpokenDraft[]) => {
      const store = activeStoreRef.current;
      if (!store) throw new Error("Could not save the live conversation to this chat.");
      const binding = bindings.get(store);
      if (!binding) throw new Error("Could not save the live conversation to this chat.");

      let chatId = binding.id;
      const projectId = binding.projectId ?? activeProjectIdRef.current ?? null;
      if (!chatId) {
        const created = await createChat(undefined, projectId);
        chatId = created.id;
        binding.id = created.id;
        binding.projectId = created.projectId ?? projectId;
        binding.title = created.title;
        activeChatIdRef.current = created.id;
        setActiveChatId(created.id);
        setActiveTitle(created.title);
        activeProjectIdRef.current = binding.projectId;
        setActiveProjectIdState(binding.projectId);
        setChats((current) => [
          {
            ...created,
            waitingForInput: false,
            presence: "idle" as const,
          },
          ...current.filter((chat) => chat.id !== created.id),
        ]);
        touchRetained(created.id, store);
      }

      const saved = await saveSpokenTurnsRequest(chatId, drafts);
      setSpokenTurns(saved);
      setActiveTitle((current) =>
        current === "New chat" && saved[0]
          ? saved.find((turn) => turn.role === "user")?.text.slice(0, 48) || current
          : current,
      );
      void reloadChats({ silent: true });
    },
    [bindings, reloadChats, touchRetained],
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      // Retire the server session when we still hold a writer, then drop Pearl
      // persistence. New Chat must not end(); delete must.
      const retained = retainedStores.get(chatId);
      if (retained) {
        const binding = bindings.get(retained);
        releaseObservation(binding ?? { stopObserving: null });
        if (retained.snapshot.session) {
          await retained.end().catch(() => {});
        }
        retainedStores.delete(chatId);
      }
      await deleteChatRequest(chatId);
      setChats((current) => current.filter((chat) => chat.id !== chatId));
      if (activeChatIdRef.current === chatId) {
        newChat();
      }
    },
    [bindings, newChat, retainedStores],
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      const renamed = await renameChatRequest(chatId, title);
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? { ...chat, title: renamed.title, updatedAt: renamed.updatedAt }
            : chat,
        ),
      );
      const retained = retainedStores.get(chatId);
      if (retained) {
        const binding = bindings.get(retained);
        if (binding) binding.title = renamed.title;
      }
      if (activeChatIdRef.current === chatId) {
        setActiveTitle(renamed.title);
      }
    },
    [bindings, retainedStores],
  );

  const setChatProject = useCallback(
    async (chatId: string, projectId: string | null) => {
      await setChatProjectRequest(chatId, projectId);
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId ? { ...chat, projectId } : chat,
        ),
      );
      const retained = retainedStores.get(chatId);
      if (retained) {
        const binding = bindings.get(retained);
        if (binding) binding.projectId = projectId;
      }
      if (activeChatIdRef.current === chatId) {
        activeProjectIdRef.current = projectId;
        setActiveProjectIdState(projectId);
      }
    },
    [bindings, retainedStores],
  );

  const wasSendPrepared = useCallback(
    (source: SessionStore) => bindings.get(source)?.sendPrepared ?? false,
    [bindings],
  );

  const clearPendingMessage = useCallback(
    (source: SessionStore) => {
      const binding = bindings.get(source);
      if (!binding) return;
      binding.pendingMessage = null;
      if (activeStoreRef.current === source) setPendingMessage(null);
    },
    [bindings],
  );

  const recoverDeadSession = useCallback(
    (source: SessionStore) => {
      const binding = bindings.get(source);
      if (!binding || binding.sessionRecoveryAttempted) return false;
      binding.sessionRecoveryAttempted = true;
      binding.archivedEvents = [
        ...mergeEventsForSnapshot(
          binding.archivedEvents,
          source.snapshot.events,
        ),
      ];
      binding.eventIndex = Math.max(
        binding.eventIndex,
        binding.archivedEvents.length,
      );
      source.newSession();
      return true;
    },
    [bindings],
  );

  const clearSessionRecovery = useCallback(
    (source: SessionStore) => {
      const binding = bindings.get(source);
      if (binding) binding.sessionRecoveryAttempted = false;
    },
    [bindings],
  );

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const retrySync = useCallback(async () => {
    const binding = bindings.get(store);
    if (!binding?.id) return;
    const id = binding.id;
    // Retry belongs to the same queue as onFinish and prepareSend. Otherwise a
    // follow-up could mark itself pending while an older retry clears the mark.
    // Always merge + snapshot — remapping live events to 0…n-1 overwrote
    // durable indices when a pending marker was still set.
    const attempt = binding.queue.then(async () => {
      const snapshot = store.snapshot;
      const events = mergeEventsForSnapshot(
        binding.archivedEvents,
        snapshot.events,
      );
      const saved = await saveChatSnapshot(id, events, snapshot.session);
      binding.archivedEvents = [...events];
      binding.savedEventCount = events.length;
      binding.eventIndex = Math.max(binding.eventIndex, events.length);
      if (saved.title) {
        binding.title = saved.title;
        if (activeChatIdRef.current === id) {
          setActiveTitle(saved.title);
        }
        setChats((current) =>
          applyChatMeta(current, id, {
            title: saved.title,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      if (snapshot.session) await saveChatSession(id, snapshot.session);
    });
    binding.queue = attempt.catch(() => {
      binding.syncFailed = true;
      if (activeStoreRef.current === store) setPersistenceError("Save failed");
    });
    try {
      await attempt;
      binding.syncFailed = false;
      if (activeStoreRef.current === store) setPersistenceError(null);
      await reloadChats({ silent: true });
    } catch {
      // The queued handler keeps the failure visible and lets later retries run.
    }
  }, [store, reloadChats, bindings]);

  // Keep the Recents presence mark in sync with the open chat's live store.
  // Only rescan pending person-waits when status flips or an interaction-shaped
  // event arrives — content.delta must not walk the whole conversation.
  useEffect(() => {
    const chatId = activeChatId;
    if (!chatId) return;
    let wasBusy =
      store.snapshot.status === "busy" || store.snapshot.status === "resuming";
    let lastWaiting = hasPendingAction(store.snapshot);
    let lastStatus = store.snapshot.status;
    let lastEvents = store.snapshot.events;
    const syncPresence = () => {
      const { status, events } = store.snapshot;
      const busy = status === "busy" || status === "resuming";
      const statusChanged = status !== lastStatus;
      lastStatus = status;
      let waiting = lastWaiting;
      if (statusChanged || eventsMayChangeWait(lastEvents, events)) {
        waiting = hasPendingAction(store.snapshot);
        lastWaiting = waiting;
      }
      lastEvents = events;
      const presence: ChatPresence = waiting
        ? "waiting"
        : status === "busy"
          ? "working"
          : "idle";
      // A turn that just finished while this chat is open stays read.
      if (wasBusy && !busy && !waiting) {
        void markChatRead(chatId).catch(() => {});
      }
      wasBusy = busy;
      patchChatPresence(chatId, presence);
    };
    syncPresence();
    return store.subscribe(syncPresence);
  }, [store, activeChatId, patchChatPresence]);

  const detachAllStores = useCallback(() => {
    for (const unsub of backgroundPresenceUnsubs.current.values()) {
      unsub();
    }
    backgroundPresenceUnsubs.current.clear();
    for (const [chatId, candidate] of [...retainedStores.entries()]) {
      const binding = bindings.get(candidate);
      binding?.stopObserving?.();
      if (binding) {
        binding.stopObserving = null;
        if (binding.timer) {
          clearTimeout(binding.timer);
          binding.timer = null;
        }
      }
      void candidate.cancel().catch(() => {});
      retainedStores.delete(chatId);
    }
    const active = activeStoreRef.current;
    if (active) {
      const binding = bindings.get(active);
      binding?.stopObserving?.();
      if (binding) {
        binding.stopObserving = null;
        if (binding.timer) {
          clearTimeout(binding.timer);
          binding.timer = null;
        }
      }
      void active.cancel().catch(() => {});
    }
  }, [bindings, retainedStores]);

  // Prewarm empty writer once signed in (no session yet).
  useEffect(() => {
    if (!signedIn || offline) return;
    const active = activeStoreRef.current;
    if (!active || active.snapshot.session) return;
    if (active.snapshot.status === "resuming") return;
    void active.prewarm().catch(() => {});
  }, [signedIn, offline, store]);

  // The auth provider restores the bearer asynchronously; load when signed in.
  // On sign-out (or provider remount via accountKey), stop streams so a stale
  // bearer cannot keep writing after sessionInvalid().
  useEffect(() => {
    if (!signedIn) {
      detachAllStores();
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) void reloadChats(); });
    return () => {
      cancelled = true;
      detachAllStores();
    };
  }, [signedIn, reloadChats, detachAllStores]);

  // Presence backstop while the app is active. Fast when any row is
  // working/waiting/unread; idle lists back off and rely on push + foreground.
  const needsFastPresencePoll = chatListNeedsPresencePoll(chats);
  useEffect(() => {
    if (!signedIn || offline) return;
    const intervalMs = needsFastPresencePoll ? PRESENCE_POLL_MS : IDLE_POLL_MS;
    const tick = () => {
      if (AppState.currentState !== "active") return;
      void reloadChats({ silent: true });
    };
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [signedIn, reloadChats, offline, needsFastPresencePoll]);

  // Foreground refresh so idle backoff does not miss updates while backgrounded.
  useEffect(() => {
    if (!signedIn || offline) return;
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      void reloadChats({ silent: true });
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [signedIn, offline, reloadChats]);

  // Coming back online: refresh presence and reattach the open session.
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = offline;
    if (!signedIn || offline || !wasOffline) return;
    setConnectionError(null);
    void reloadChats({ silent: true });
    const active = activeStoreRef.current;
    if (active?.snapshot.session) {
      void reconnect(active);
    }
  }, [offline, signedIn, reloadChats, reconnect]);

  const getActiveStore = useCallback(() => {
    const current = activeStoreRef.current;
    if (!current) throw new Error("No active chat store.");
    return current;
  }, []);

  const getActiveChatId = useCallback(
    () => activeChatIdRef.current,
    [],
  );

  const getActiveCustomAgent = useCallback(
    () => activeCustomAgentRef.current,
    [],
  );

  const listValue = useMemo(
    (): ChatListContextValue => ({
      chats,
      chatsLoading,
      chatsReady,
      chatsError,
      hasMoreChats: cursor !== null,
      loadMoreChats,
      reloadChats,
      patchChatPresence,
      patchChatMeta,
      deleteChat,
      renameChat,
      setChatProject,
    }),
    [
      chats,
      chatsLoading,
      chatsReady,
      chatsError,
      cursor,
      loadMoreChats,
      reloadChats,
      patchChatPresence,
      patchChatMeta,
      deleteChat,
      renameChat,
      setChatProject,
    ],
  );

  const activeValue = useMemo(
    (): ActiveChatContextValue => ({
      store,
      getActiveStore,
      getActiveChatId,
      getActiveCustomAgent,
      activeChatId,
      activeProjectId,
      setActiveProjectId,
      activeCustomAgent,
      setActiveCustomAgent,
      newChatEntry,
      activeTitle,
      resumeChatFromPush,
      reconnect,
      selectChat,
      selectionError,
      persistenceError,
      connectionError,
      clearConnectionError,
      clearSessionRecovery,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      clearPendingMessage,
      recoverDeadSession,
      newChat,
      spokenTurns,
      saveSpokenTurns,
      quickTurns,
      setQuickTurns,
    }),
    [
      store,
      getActiveStore,
      getActiveChatId,
      getActiveCustomAgent,
      activeChatId,
      activeProjectId,
      setActiveProjectId,
      activeCustomAgent,
      setActiveCustomAgent,
      newChatEntry,
      activeTitle,
      resumeChatFromPush,
      reconnect,
      selectChat,
      selectionError,
      persistenceError,
      connectionError,
      clearConnectionError,
      clearSessionRecovery,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      clearPendingMessage,
      recoverDeadSession,
      newChat,
      spokenTurns,
      saveSpokenTurns,
      quickTurns,
      setQuickTurns,
    ],
  );

  return (
    <ChatListContext.Provider value={listValue}>
      <ActiveChatContext.Provider value={activeValue}>
        {children}
      </ActiveChatContext.Provider>
    </ChatListContext.Provider>
  );
}

/** Recents list + list mutations — does not re-render on active-store churn. */
export function useChatList(): ChatListContextValue {
  const context = useContext(ChatListContext);
  if (!context) {
    throw new Error("useChatList must be used within ChatsProvider.");
  }
  return context;
}

/** Active session store / turns — does not re-render on list-only updates. */
export function useActiveChat(): ActiveChatContextValue {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ChatsProvider.");
  }
  return context;
}

/** Combined list + active chat (re-renders on either). Prefer narrow hooks. */
export function useChats(): ChatsContextValue {
  return { ...useChatList(), ...useActiveChat() };
}

/**
 * Shared events for the open chat tree. ChatScreen publishes the snapshot it
 * already subscribed to so timeline rows / task cards do not each open another
 * store listener (and so SubagentRunsProvider can sit under chat, not the app root).
 */
const EveEventsContext = createContext<readonly unknown[] | null>(null);

export function EveEventsProvider({
  events,
  children,
}: {
  readonly events: readonly unknown[];
  readonly children: ReactNode;
}) {
  return (
    <EveEventsContext.Provider value={events}>
      {children}
    </EveEventsContext.Provider>
  );
}

/**
 * The active chat's authoritative eve event stream (subagent runs, turn
 * timings — the same events the web's session timeline and task cards
 * consume). Prefers EveEventsProvider when mounted; otherwise subscribes to
 * the active store (reference-stable between publishes).
 */
export function useEveEvents(): readonly unknown[] {
  const fromProvider = useContext(EveEventsContext);
  const { store } = useActiveChat();
  const fromStore = useSyncExternalStore(
    (cb) => (fromProvider != null ? () => {} : store.subscribe(cb)),
    () => (fromProvider != null ? fromProvider : store.snapshot.events),
    () => (fromProvider != null ? fromProvider : store.snapshot.events),
  );
  return fromProvider ?? fromStore;
}
