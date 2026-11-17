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
import { beginStreamTrace, traceStream } from "./stream-trace";
import {
  clearLiveReplyText,
  pushLiveReplyDelta,
  reconcileLiveReplyWithSnapshot,
} from "./live-reply-text";
import { pendingMessageLabel, hasPendingAction } from "./message-projection";
import type { LiveSpokenDraft, SpokenTurn } from "../../lib/chat/spoken-turns";
import {
  appendChatEvents,
  attachChatToProject,
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
} from "./chats-client";
import { mergeEventsForSnapshot } from "../../lib/chat/eve-session-recovery";
import { waitingLabelForText } from "../../lib/pearl-lane";
import { setWaitingLabel } from "../../lib/waiting-label";
import { useAuth } from "./auth";

/** Keep this many recently opened SessionStores warm for instant re-open. */
const RETAINED_STORE_LIMIT = 10;
/** Silent list backstop when nothing is working/waiting. */
const PRESENCE_POLL_MS = 5_000;
/** Faster backstop while any Recents row is live. */
const PRESENCE_POLL_ACTIVE_MS = 1_500;

/** Row fields the recents list actually renders. A new array with the same
 * rows still rebuilds the SwiftUI list, so unchanged polls must keep identity. */
function sameChatRows(
  current: readonly ChatListItem[],
  next: readonly ChatListItem[],
): boolean {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i += 1) {
    const a = current[i]!;
    const b = next[i]!;
    if (
      a.id !== b.id ||
      a.title !== b.title ||
      a.updatedAt !== b.updatedAt ||
      (a.projectId ?? null) !== (b.projectId ?? null) ||
      (a.presence ?? "idle") !== (b.presence ?? "idle") ||
      Boolean(a.waitingForInput) !== Boolean(b.waitingForInput)
    ) {
      return false;
    }
  }
  return true;
}

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

type ChatsContextValue = {
  /** The active eve store (one React-mounted store; others may be LRU-retained). */
  readonly store: SessionStore;
  readonly activeChatId: string | null;
  /** Project linked to the active chat (Plan mode / project chats). */
  readonly activeProjectId: string | null;
  readonly setActiveProjectId: (projectId: string | null) => void;
  /** Advances only when the user enters a fresh chat, never during a send. */
  readonly newChatEntry: number;
  readonly activeTitle: string;
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
  ) => void;
  /** Open a stored chat (replays its events, attaches its session). */
  readonly selectChat: (chatId: string) => Promise<boolean>;
  readonly selectionError: string | null;
  readonly persistenceError: string | null;
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
  /** Delete a stored chat; opens a new chat when the deleted id is active. */
  readonly deleteChat: (chatId: string) => Promise<void>;
  /** Rename a stored chat and refresh local list / active title. */
  readonly renameChat: (chatId: string, title: string) => Promise<void>;
  /** Attach or detach a chat from a project; updates list + active binding. */
  readonly setChatProject: (
    chatId: string,
    projectId: string | null,
  ) => Promise<void>;
  /** Live voice lines shown until eve imports them on the next real send. */
  readonly spokenTurns: readonly SpokenTurn[];
  /** Persist a live call without starting a Pearl turn. */
  readonly saveSpokenTurns: (turns: readonly LiveSpokenDraft[]) => Promise<void>;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

type ChatBinding = {
  id: string | null;
  title: string;
  projectId: string | null;
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
  queue: Promise<void>;
  batch: { event: SessionStreamEvent; eventIndex: number }[];
  timer: ReturnType<typeof setTimeout> | null;
  syncFailed: boolean;
  /** Release SessionStore observation when the store is no longer mounted. */
  stopObserving: (() => void) | null;
};

const traceSend = (binding: ChatBinding, stage: string) => {
  if (__DEV__ && binding.sendStartedAt !== null) {
    console.info(`[mobile send] ${stage} +${Math.round(performance.now() - binding.sendStartedAt)}ms`);
  }
};

/** A store keeps its own chat identity even while another chat is selected. */
export function ChatsProvider({ children }: { readonly children: ReactNode }) {
  const { signedIn } = useAuth();
  const activeChatIdRef = useRef<string | null>(null);
  const selectionGeneration = useRef(0);
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
  const [newChatEntry, setNewChatEntry] = useState(0);
  const [activeTitle, setActiveTitle] = useState("New chat");
  const [chats, setChats] = useState<readonly ChatListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsReady, setChatsReady] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [spokenTurns, setSpokenTurns] = useState<readonly SpokenTurn[]>([]);

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
    // Do not replay saved pre-v27 events as initialEvents — open the stored
    // session and resume() so the server upconverts older history.
    const store = new SessionStore({
      baseUrl: AGENT_URL,
      // Follow coder / researcher / etc. child sessions so their approvals and
      // live transcripts reach the parent thread (bounded by eve's depth caps).
      followAgents: true,
      headers: () => {
        const credential = getAuthCookie();
        return credential ? { authorization: `Bearer ${credential}` } : ({} as Record<string, string>);
      },
      ...(chat?.session
        ? { initialSession: chat.session as ClientSessionState }
        : {}),
    });
    bindings.set(store, {
      id: chat?.id ?? null,
      title: chat?.title ?? "New chat",
      projectId: chat?.projectId ?? null,
      pendingMessage: chat?.pendingUserMessage ?? null,
      sendPrepared: false,
      sendStartedAt: null,
      eventIndex: chat?.events.length ?? 0,
      savedEventCount: chat?.events.length ?? 0,
      archivedEvents: chat?.events ? [...chat.events] : [],
      sessionRecoveryAttempted: false,
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
    if (!silent) setChatsLoading(true);

    try {
      const page = await listChats(null);
      setChats((current) => {
        if (!silent || current.length === 0) {
          return sameChatRows(current, page.chats) ? current : page.chats;
        }
        // Merge page-1 into any already-loaded pages so a presence poll or
        // turn-end snapshot does not drop history the user scrolled into.
        const freshById = new Map(page.chats.map((chat) => [chat.id, chat]));
        const seen = new Set<string>();
        const merged: ChatListItem[] = [];
        for (const chat of page.chats) {
          merged.push(chat);
          seen.add(chat.id);
        }
        for (const chat of current) {
          if (seen.has(chat.id)) continue;
          const updated = freshById.get(chat.id);
          merged.push(updated ?? chat);
          seen.add(chat.id);
        }
        // A new array rebuilds the SwiftUI list and drops taps. Keep the
        // previous rows when titles, presence, and order did not change.
        return sameChatRows(current, merged) ? current : merged;
      });
      // Only reset the cursor on a full replace; silent merges keep pagination.
      if (!silent) {
        setCursor(page.nextCursor);
      } else {
        setCursor((current) => current ?? page.nextCursor);
      }
      setChatsError(null);
    } catch {
      // Preserve the last successful list but expose the offline state.
      setChatsError("Could not load history. Check your connection and retry.");
    } finally {
      if (!silent) setChatsLoading(false);
      // The chats list can mount after this fetch (billing gate). A loading
      // edge the list itself never saw must not keep the empty state hidden.
      setChatsReady(true);
    }
  }, []);

  const loadMoreChats = useCallback(async () => {
    if (!cursor) {
      return;
    }

    setChatsLoading(true);

    try {
      const page = await listChats(cursor);
      setChats((current) => [...current, ...page.chats]);
      setCursor(page.nextCursor);
      setChatsError(null);
    } catch {
      setChatsError("Could not load more chats. Tap Load more to retry.");
    } finally {
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
    (chatId: string, presence: ChatPresence) => {
      setChats((current) => {
        const index = current.findIndex((chat) => chat.id === chatId);
        if (index < 0) return current;
        const existing = current[index]!;
        if (
          existing.presence === presence &&
          Boolean(existing.waitingForInput) === (presence === "waiting")
        ) {
          return current;
        }
        const next = [...current];
        next[index] = {
          ...existing,
          presence,
          waitingForInput: presence === "waiting",
        };
        return next;
      });
    },
    [],
  );

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

    binding.stopObserving?.();
    binding.stopObserving = store.observe();
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
              pushLiveReplyDelta({
                turnId:
                  typeof event.scope?.turnId === "string"
                    ? event.scope.turnId
                    : undefined,
                partId: data.partId,
                kind: typeof data.kind === "string" ? data.kind : undefined,
                delta,
              });
            }
          }
        } else if (event.type === "turn.settled") {
          clearLiveReplyText();
          traceStream("settled");
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
          enqueue(() => binding.syncFailed ? Promise.resolve() : saveChatSession(id, session));
        }
      },
      onFinish: (snapshot) => {
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
          await saveChatSnapshot(id, events, snapshot.session);
          binding.archivedEvents = [...events];
          binding.savedEventCount = events.length;
          binding.eventIndex = Math.max(binding.eventIndex, events.length);
          traceSend(binding, "snapshot saved");
          binding.syncFailed = false;
          if (activeStoreRef.current === store) setPersistenceError(null);
          // The next turn waits on this queue; history GET must not hold its durable mark.
          void reloadChats({ silent: true });
          // Snapshot settled — retry overflow eviction now that this writer is idle.
          evictRetainedOverflow();
        });
      },
      onError: () => {
        if (activeStoreRef.current === store && binding.pendingMessage) {
          setPendingMessage(binding.pendingMessage);
        }
      },
      prepareSend: async (input) => {
        binding.sendPrepared = false;
        binding.sendStartedAt = performance.now();
        beginStreamTrace("send");
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
        // onMessage imports spoken turns for this send; drop the overlay source.
        if (message && activeStoreRef.current === store) {
          setSpokenTurns([]);
        }
        traceSend(binding, "pending marker saved");
        if (binding.id) touchRetained(binding.id, store);
        return input;
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

    if (store.snapshot.session) void store.resume();
    return () => {
      flush();
      const stillWorking =
        store.snapshot.status === "busy" || Boolean(binding.pendingMessage);
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
  ]);

  // When iOS/Android returns the process to the foreground, catch up every
  // still-working retained store (not only the open chat).
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
        const status = candidate.snapshot.status;
        if (status !== "busy" && status !== "resuming") continue;
        void candidate.resume().catch(() => {
          // Already streaming, or a transient network error — leave alone.
        });
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => {
      subscription.remove();
    };
  }, [retainedStores]);

  const markActiveChatRead = useCallback((chatId: string) => {
    // Optimistic: opening clears unread; waiting/working stay visible.
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

  const selectChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      const generation = ++selectionGeneration.current;
      if (chatId === activeChatIdRef.current) {
        markActiveChatRead(chatId);
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
        // Pending is only for empty "Carry out" chats. If this store already
        // has a session/history, reopening must resume — never resend.
        const hasHistory =
          Boolean(retained.snapshot.session) ||
          retained.snapshot.events.length > 0 ||
          retained.snapshot.messages.length > 0;
        const pending = hasHistory ? null : binding.pendingMessage;
        if (hasHistory) binding.pendingMessage = null;
        setPendingMessage(pending);
        setSpokenTurns([]);
        setPersistenceError(binding.syncFailed ? "Save failed" : null);
        touchRetained(chatId, retained);
        setStore(retained);
        pruneIdleStore(prior);
        markActiveChatRead(chatId);
        // Retained stores skip a network round-trip; refresh spoken turns.
        void getChat(chatId).then((fresh) => {
          if (activeChatIdRef.current === chatId && fresh) {
            setSpokenTurns(fresh.spokenTurns ?? []);
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
        // The server scopes the pending marker to its turn timestamp and clears
        // it after a settled event or snapshot. Matching text here could mistake
        // an older identical message for confirmation of this uncertain turn.
        // If a session or events already exist, treat pending as stale — the
        // user is reopening history, not completing a Carry-out handoff.
        const hasHistory =
          Boolean(chat.session) || chat.events.length > 0;
        const stillPending =
          hasHistory ? null : chat.pendingUserMessage;
        bindings.get(nextStore)!.pendingMessage = stillPending;
        const prior = activeStoreRef.current;
        activeStoreRef.current = nextStore;
        activeChatIdRef.current = chat.id;
        setActiveChatId(chat.id);
        setActiveTitle(chat.title);
        activeProjectIdRef.current = chat.projectId ?? null;
        setActiveProjectIdState(chat.projectId ?? null);
        setPendingMessage(stillPending);
        setSpokenTurns(chat.spokenTurns ?? []);
        setPersistenceError(null);
        setStore(nextStore);
        pruneIdleStore(prior);
        markActiveChatRead(chat.id);
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
    ],
  );

  const newChat = useCallback(() => {
    const priorChatId = activeChatIdRef.current;
    ++selectionGeneration.current;
    activeChatIdRef.current = null;
    setActiveChatId(null);
    activeProjectIdRef.current = null;
    setActiveProjectIdState(null);
    setNewChatEntry((current) => current + 1);
    setActiveTitle("New chat");
    setPendingMessage(null);
    setSpokenTurns([]);
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
      await deleteChatRequest(chatId);
      setChats((current) => current.filter((chat) => chat.id !== chatId));
      retainedStores.delete(chatId);
      if (activeChatIdRef.current === chatId) {
        newChat();
      }
    },
    [newChat, retainedStores],
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
      await saveChatSnapshot(id, events, snapshot.session);
      binding.archivedEvents = [...events];
      binding.savedEventCount = events.length;
      binding.eventIndex = Math.max(binding.eventIndex, events.length);
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

  // Presence backstop: silent poll while the app is active. Faster when any
  // row is working/waiting so missed silent pushes still catch up quickly —
  // including while the user is inside /chat, not only on home.
  const needsFastPresencePoll = chats.some(
    (item) => item.presence === "working" || item.presence === "waiting",
  );
  useEffect(() => {
    if (!signedIn) return;
    const intervalMs = needsFastPresencePoll
      ? PRESENCE_POLL_ACTIVE_MS
      : PRESENCE_POLL_MS;
    const tick = () => {
      if (AppState.currentState !== "active") return;
      void reloadChats({ silent: true });
    };
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [signedIn, reloadChats, needsFastPresencePoll]);

  const value = useMemo(
    () => ({
      store,
      activeChatId,
      activeProjectId,
      setActiveProjectId,
      newChatEntry,
      activeTitle,
      chats,
      chatsLoading,
      chatsReady,
      chatsError,
      hasMoreChats: cursor !== null,
      loadMoreChats,
      reloadChats,
      patchChatPresence,
      selectChat,
      selectionError,
      persistenceError,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      clearPendingMessage,
      recoverDeadSession,
      newChat,
      deleteChat,
      renameChat,
      setChatProject,
      spokenTurns,
      saveSpokenTurns,
    }),
    [
      store,
      activeChatId,
      activeProjectId,
      setActiveProjectId,
      newChatEntry,
      activeTitle,
      chats,
      chatsLoading,
      chatsReady,
      chatsError,
      cursor,
      loadMoreChats,
      reloadChats,
      patchChatPresence,
      selectChat,
      selectionError,
      persistenceError,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      clearPendingMessage,
      recoverDeadSession,
      newChat,
      deleteChat,
      renameChat,
      setChatProject,
      spokenTurns,
      saveSpokenTurns,
    ],
  );

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
}

export function useChats(): ChatsContextValue {
  const context = useContext(ChatsContext);

  if (!context) {
    throw new Error("useChats must be used within ChatsProvider.");
  }

  return context;
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
  const { store } = useChats();
  const fromStore = useSyncExternalStore(
    (cb) => (fromProvider != null ? () => {} : store.subscribe(cb)),
    () => (fromProvider != null ? fromProvider : store.snapshot.events),
    () => (fromProvider != null ? fromProvider : store.snapshot.events),
  );
  return fromProvider ?? fromStore;
}
