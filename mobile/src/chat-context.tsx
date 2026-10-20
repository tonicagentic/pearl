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
import {
  EveAgentStore,
  defaultMessageReducer,
  type ClientSessionState,
  type EveMessageData,
  type MessageStreamEvent,
} from "eve/client";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  appendChatEvents,
  createChat,
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
  readonly store: EveAgentStore<EveMessageData>;
  readonly activeChatId: string | null;
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
  readonly wasSendPrepared: (source: EveAgentStore<EveMessageData>) => boolean;
  /** Drop the active chat and start fresh (the row is created on first send). */
  readonly newChat: () => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

type ChatBinding = {
  id: string | null;
  title: string;
  pendingMessage: string | null;
  sendPrepared: boolean;
  sendStartedAt: number | null;
  eventIndex: number;
  queue: Promise<void>;
  batch: { event: MessageStreamEvent; eventIndex: number }[];
  timer: ReturnType<typeof setTimeout> | null;
  syncFailed: boolean;
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
  const [bindings] = useState(() => new WeakMap<EveAgentStore<EveMessageData>, ChatBinding>());
  // Retain a store until its final checkpoint finishes; reselecting it must not
  // create a second writer for the same chat.
  const [retainedStores] = useState(() => new Map<string, EveAgentStore<EveMessageData>>());
  const activeStoreRef = useRef<EveAgentStore<EveMessageData> | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatEntry, setNewChatEntry] = useState(0);
  const [activeTitle, setActiveTitle] = useState("New chat");
  const [chats, setChats] = useState<readonly ChatListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const buildStore = useCallback((chat: ActiveChat | null) => {
    const store = new EveAgentStore<EveMessageData>({
      host: AGENT_URL,
      headers: () => {
        const credential = getAuthCookie();
        return credential ? { authorization: `Bearer ${credential}` } : ({} as Record<string, string>);
      },
      reducer: defaultMessageReducer(),
      ...(chat
        ? {
            initialEvents: chat.events,
            ...(chat.session
              ? { initialSession: chat.session as ClientSessionState }
              : {}),
          }
        : {}),
    });
    bindings.set(store, {
      id: chat?.id ?? null,
      title: chat?.title ?? "New chat",
      pendingMessage: chat?.pendingUserMessage ?? null,
      sendPrepared: false,
      sendStartedAt: null,
      eventIndex: store.snapshot.events.length,
      queue: Promise.resolve(),
      batch: [],
      timer: null,
      syncFailed: false,
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

  const pruneIdleStore = useCallback((prior: EveAgentStore<EveMessageData> | null) => {
    if (!prior) return;
    const binding = bindings.get(prior);
    if (!binding?.id || binding.pendingMessage || binding.syncFailed) return;
    // Do not evict until all queued events and snapshots have settled.
    void binding.queue.then(() => {
      if (activeStoreRef.current !== prior && prior.snapshot.status === "ready" &&
          !binding.pendingMessage && !binding.syncFailed && binding.id &&
          retainedStores.get(binding.id) === prior) {
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

    store.setCallbacks({
      onEvent: (event) => {
        if (!binding.id) return;
        binding.batch.push({ event, eventIndex: binding.eventIndex++ });
        if (event.type === "message.received") {
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
        enqueue(async () => {
          await saveChatSnapshot(id, snapshot.events, snapshot.session);
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
        const content = input.message;
        const textPart = Array.isArray(content) ? content.find((part) =>
          part.type === "text" &&
          !part.text.startsWith("[Attached PDF:") &&
          !part.text.startsWith("[Attached text file:"),
        ) : undefined;
        const text = typeof content === "string"
          ? content
          : textPart?.type === "text" ? textPart.text : "";
        // Attachment-only sends need a durable pending marker until eve confirms
        // message.received. Never store file bytes or extracted document text here.
        const message = text || (Array.isArray(content) && content.length > 0
          ? "[Attachment]"
          : "");
        if (!binding.id) {
          const created = await createChat(message || undefined);
          binding.id = created.id;
          if (activeStoreRef.current === store) {
            activeChatIdRef.current = created.id;
            setActiveChatId(created.id);
            setActiveTitle(created.title);
          }
          setChats((current) => [created, ...current.filter((chat) => chat.id !== created.id)]);
        } else if (message) {
          // A previous turn's snapshot clears pendingUserMessage. Wait for that
          // checkpoint before marking the new turn, or it could erase our mark.
          await binding.queue;
          await markPendingChatMessage(binding.id, message);
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
    };
  }, [store, reloadChats, bindings, retainedStores]);

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
        setPendingMessage(binding.pendingMessage);
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
        const stillPending = chat.pendingUserMessage;
        bindings.get(nextStore)!.pendingMessage = stillPending;
        const prior = activeStoreRef.current;
        activeStoreRef.current = nextStore;
        activeChatIdRef.current = chat.id;
        setActiveChatId(chat.id);
        setActiveTitle(chat.title);
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
    ++selectionGeneration.current;
    activeChatIdRef.current = null;
    setActiveChatId(null);
    setNewChatEntry((current) => current + 1);
    setActiveTitle("New chat");
    setPendingMessage(null);
    setPersistenceError(null);
    setSelectionError(null);
    const nextStore = buildStore(null);
    const prior = activeStoreRef.current;
    activeStoreRef.current = nextStore;
    setStore(nextStore);
    pruneIdleStore(prior);
  }, [buildStore, pruneIdleStore]);

  const wasSendPrepared = useCallback(
    (source: EveAgentStore<EveMessageData>) => bindings.get(source)?.sendPrepared ?? false,
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
    }),
    [
      store,
      activeChatId,
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
