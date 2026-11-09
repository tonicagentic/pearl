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
import { traceStream } from "./stream-trace";
import { pendingMessageLabel, hasPendingAction } from "./message-projection";
import {
  appendChatEvents,
  attachChatToProject,
  createChat,
  deleteChat as deleteChatRequest,
  getChat,
  listChats,
  markPendingChatMessage,
  saveChatSession,
  saveChatSnapshot,
  type ActiveChat,
  type ChatListItem,
} from "./chats-client";
import { useAuth } from "./auth";

type ChatsContextValue = {
  /** The active eve store: rebuilt whenever a different chat is selected. */
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
  readonly chatsError: string | null;
  readonly hasMoreChats: boolean;
  readonly loadMoreChats: () => Promise<void>;
  readonly reloadChats: () => Promise<void>;
  /** Open a stored chat (replays its events, attaches its session). */
  readonly selectChat: (chatId: string) => Promise<boolean>;
  readonly selectionError: string | null;
  readonly persistenceError: string | null;
  readonly pendingMessage: string | null;
  readonly retrySync: () => Promise<void>;
  /** Whether the durable pending marker completed before this store's send. */
  readonly wasSendPrepared: (source: SessionStore) => boolean;
  /** Drop the active chat and start fresh (the row is created on first send). */
  readonly newChat: () => void;
  /** Delete a stored chat; opens a new chat when the deleted id is active. */
  readonly deleteChat: (chatId: string) => Promise<void>;
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
  // Retain a store until its final checkpoint finishes; reselecting it must not
  // create a second writer for the same chat.
  const [retainedStores] = useState(() => new Map<string, SessionStore>());
  const activeStoreRef = useRef<SessionStore | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const [newChatEntry, setNewChatEntry] = useState(0);
  const [activeTitle, setActiveTitle] = useState("New chat");
  const [chats, setChats] = useState<readonly ChatListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const setActiveProjectId = useCallback((projectId: string | null) => {
    activeProjectIdRef.current = projectId;
    setActiveProjectIdState(projectId);
    const store = activeStoreRef.current;
    if (store) {
      const binding = bindings.get(store);
      if (binding) binding.projectId = projectId;
    }
  }, [bindings]);

  const buildStore = useCallback((chat: ActiveChat | null) => {
    // Do not replay saved pre-v27 events as initialEvents — open the stored
    // session and resume() so the server upconverts older history.
    const store = new SessionStore({
      baseUrl: AGENT_URL,
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
      eventIndex: 0,
      savedEventCount: 0,
      queue: Promise.resolve(),
      batch: [],
      timer: null,
      syncFailed: false,
      stopObserving: null,
    });
    if (chat) retainedStores.set(chat.id, store);
    return store;
  }, [bindings, retainedStores]);

  const reloadChats = useCallback(async () => {
    setChatsLoading(true);

    try {
      const page = await listChats(null);
      setChats(page.chats);
      setCursor(page.nextCursor);
      setChatsError(null);
    } catch {
      // Preserve the last successful list but expose the offline state.
      setChatsError("Could not load history. Check your connection and retry.");
    } finally {
      setChatsLoading(false);
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

  const pruneIdleStore = useCallback((prior: SessionStore | null) => {
    if (!prior) return;
    const binding = bindings.get(prior);
    if (!binding?.id || binding.pendingMessage || binding.syncFailed) return;
    // Do not evict until all queued events and snapshots have settled.
    void binding.queue.then(() => {
      if (activeStoreRef.current !== prior && prior.snapshot.status === "idle" &&
          !binding.pendingMessage && !binding.syncFailed && binding.id &&
          retainedStores.get(binding.id) === prior) {
        binding.stopObserving?.();
        binding.stopObserving = null;
        retainedStores.delete(binding.id);
      }
    });
  }, [bindings, retainedStores]);

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
          const delta = event.data.delta;
          if (typeof delta === "string") traceStream("delta", delta.length);
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
        // eve fires onFinish on mount/resume even when nothing new arrived.
        // Skip the snapshot so idle opens do not bump Recents order.
        if (snapshot.events.length === binding.savedEventCount) {
          if (activeStoreRef.current !== store && !binding.pendingMessage && retainedStores.get(id) === store) {
            retainedStores.delete(id);
          }
          return;
        }
        enqueue(async () => {
          await saveChatSnapshot(id, snapshot.events, snapshot.session);
          binding.savedEventCount = snapshot.events.length;
          traceSend(binding, "snapshot saved");
          binding.syncFailed = false;
          if (activeStoreRef.current === store) setPersistenceError(null);
          // The next turn waits on this queue; history GET must not hold its durable mark.
          void reloadChats();
          // Check after this queue item settles, not while its promise is pending.
          if (activeStoreRef.current !== store && !binding.pendingMessage && retainedStores.get(id) === store) {
            retainedStores.delete(id);
          }
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
        // An attachment-only turn uses a safe title/marker. Neither a
        // correlation token nor pasted document text belongs in chat metadata.
        const message = pendingMessageLabel(input.message);
        const projectId =
          binding.projectId ?? activeProjectIdRef.current ?? null;
        if (!binding.id) {
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
            { ...created, waitingForInput: false },
            ...current.filter((chat) => chat.id !== created.id),
          ]);
        } else {
          if (projectId && !binding.projectId) {
            await attachChatToProject(binding.id, projectId);
            binding.projectId = projectId;
            if (activeStoreRef.current === store) {
              activeProjectIdRef.current = projectId;
              setActiveProjectIdState(projectId);
            }
          }
          if (message) {
            // A previous turn's snapshot clears pendingUserMessage. Wait for that
            // checkpoint before marking the new turn, or it could erase our mark.
            await binding.queue;
            await markPendingChatMessage(binding.id, message);
          }
        }
        binding.pendingMessage = message || null;
        binding.sendPrepared = true;
        traceSend(binding, "pending marker saved");
        if (binding.id) retainedStores.set(binding.id, store);
        return input;
      },
    });
    // An attached session can have an unfinished turn after the app was killed.
    // Replaying its durable stream reconciles accepted messages before the user
    // decides whether an unsent message needs resending.
    if (store.snapshot.session) void store.resume();
    return () => {
      flush();
      binding.stopObserving?.();
      binding.stopObserving = null;
    };
  }, [store, reloadChats, bindings, retainedStores]);

  // When iOS/Android returns the process to the foreground, catch up the
  // active chat from eve's durable stream without waiting for a banner tap.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") {
        return;
      }
      const active = activeStoreRef.current;
      if (!active?.snapshot.session) {
        return;
      }
      void active.resume().catch(() => {
        // Already streaming, or a transient network error — leave the UI alone.
      });
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const selectChat = useCallback(
    async (chatId: string): Promise<boolean> => {
      const generation = ++selectionGeneration.current;
      if (chatId === activeChatIdRef.current) return true;
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
        setPersistenceError(binding.syncFailed ? "Save failed" : null);
        setStore(retained);
        pruneIdleStore(prior);
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
        setPersistenceError(null);
        setStore(nextStore);
        pruneIdleStore(prior);
        return true;
      } catch {
        if (generation === selectionGeneration.current) {
          setSelectionError("Could not open conversation. Check your connection and try again.");
        }
        return false;
      }
    },
    [buildStore, bindings, retainedStores, pruneIdleStore],
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

  const wasSendPrepared = useCallback(
    (source: SessionStore) => bindings.get(source)?.sendPrepared ?? false,
    [bindings],
  );

  const retrySync = useCallback(async () => {
    const binding = bindings.get(store);
    if (!binding?.id) return;
    const id = binding.id;
    // Retry belongs to the same queue as onFinish and prepareSend. Otherwise a
    // follow-up could mark itself pending while an older retry clears the mark.
    const attempt = binding.queue.then(async () => {
      const snapshot = store.snapshot;
      if (binding.pendingMessage) {
        await appendChatEvents(id, snapshot.events.map((event, eventIndex) => ({ event, eventIndex })));
        if (snapshot.session) await saveChatSession(id, snapshot.session);
      } else {
        await saveChatSnapshot(id, snapshot.events, snapshot.session);
        binding.savedEventCount = snapshot.events.length;
      }
    });
    binding.queue = attempt.catch(() => {
      binding.syncFailed = true;
      if (activeStoreRef.current === store) setPersistenceError("Save failed");
    });
    try {
      await attempt;
      binding.syncFailed = false;
      if (activeStoreRef.current === store) setPersistenceError(null);
      await reloadChats();
    } catch {
      // The queued handler keeps the failure visible and lets later retries run.
    }
  }, [store, reloadChats, bindings]);

  // Keep the Recents "needs you" dot in sync with the open chat's HITL park.
  useEffect(() => {
    const chatId = activeChatId;
    if (!chatId) return;
    return store.subscribe(() => {
      const waiting = hasPendingAction(store.snapshot);
      setChats((current) => {
        const index = current.findIndex((chat) => chat.id === chatId);
        if (index < 0 || Boolean(current[index]?.waitingForInput) === waiting) {
          return current;
        }
        const next = [...current];
        next[index] = { ...next[index]!, waitingForInput: waiting };
        return next;
      });
    });
  }, [store, activeChatId]);

  // The auth provider restores the bearer asynchronously; load when signed in.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) void reloadChats(); });
    return () => { cancelled = true; };
  }, [signedIn, reloadChats]);

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
      chatsError,
      hasMoreChats: cursor !== null,
      loadMoreChats,
      reloadChats,
      selectChat,
      selectionError,
      persistenceError,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      newChat,
      deleteChat,
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
      chatsError,
      cursor,
      loadMoreChats,
      reloadChats,
      selectChat,
      selectionError,
      persistenceError,
      pendingMessage,
      retrySync,
      wasSendPrepared,
      newChat,
      deleteChat,
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
 * The active chat's authoritative eve event stream (subagent runs, turn
 * timings — the same events the web's session timeline and task cards
 * consume). Reference-stable between publishes, so useSyncExternalStore-safe.
 */
export function useEveEvents(): readonly unknown[] {
  const { store } = useChats();

  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.events,
    () => store.snapshot.events,
  );
}
