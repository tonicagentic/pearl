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
} from "eve/client";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  createChat,
  getChat,
  listChats,
  saveChatSession,
  saveChatSnapshot,
  type ActiveChat,
  type ChatListItem,
} from "./chats-client";

type ChatsContextValue = {
  /** The active eve store: rebuilt whenever a different chat is selected. */
  readonly store: EveAgentStore<EveMessageData>;
  readonly activeChatId: string | null;
  readonly activeTitle: string;
  readonly chats: readonly ChatListItem[];
  readonly chatsLoading: boolean;
  readonly hasMoreChats: boolean;
  readonly loadMoreChats: () => Promise<void>;
  readonly reloadChats: () => Promise<void>;
  /** Open a stored chat (replays its events, attaches its session). */
  readonly selectChat: (chatId: string) => Promise<void>;
  /** Drop the active chat and start fresh (the row is created on first send). */
  readonly newChat: () => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

/**
 * Multi-chat support for mobile: the drawer lists the durable chats (the same
 * rows the web sidebar reads) and selecting one builds an EveAgentStore
 * attached to that chat's session, replaying its events through the reducer.
 * Persistence mirrors the web's chat page: the session cursor is saved the
 * moment eve returns it, and the full event snapshot is saved on finish.
 */
export function ChatsProvider({ children }: { readonly children: ReactNode }) {
  // The id is tracked in a ref because the store's callbacks (prepareSend,
  // onSessionChange, onFinish) are long-lived and must not go stale; the id
  // is only assigned on the first send of a fresh chat.
  const activeChatIdRef = useRef<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("New session");
  const [chats, setChats] = useState<readonly ChatListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);

  const buildStore = useCallback((chat: ActiveChat | null) => {
    return new EveAgentStore({
      host: AGENT_URL,
      headers: () => {
        const cookie = getAuthCookie();
        return cookie ? { cookie } : ({} as Record<string, string>);
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
  }, []);

  const reloadChats = useCallback(async () => {
    setChatsLoading(true);

    try {
      const page = await listChats(null);
      setChats(page.chats);
      setCursor(page.nextCursor);
    } catch {
      // The drawer tolerates a failed list (sign-in required, offline) —
      // keep whatever was last shown.
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
    } catch {
      // Ignore: paging is best-effort.
    } finally {
      setChatsLoading(false);
    }
  }, [cursor]);

  // One store per active chat; rebuilt only when the selection changes.
  const [store, setStore] = useState(() => buildStore(null));

  // Wire persistence callbacks to the ACTIVE chat id (via ref — the id is
  // assigned mid-turn by prepareSend).
  useEffect(() => {
    store.setCallbacks({
      onSessionChange: (session) => {
        const chatId = activeChatIdRef.current;

        if (chatId && session) {
          void saveChatSession(chatId, session).catch(() => {});
        }
      },
      onFinish: (snapshot) => {
        const chatId = activeChatIdRef.current;

        if (!chatId) {
          return;
        }

        void saveChatSnapshot(chatId, snapshot.events, snapshot.session)
          .then(reloadChats)
          .catch(() => {});
      },
      prepareSend: async (input) => {
        if (!activeChatIdRef.current) {
          const message =
            typeof input.message === "string" ? input.message : "";
          const created = await createChat(message || undefined);
          activeChatIdRef.current = created.id;
          setActiveChatId(created.id);
          setActiveTitle(created.title);
          void reloadChats();
        }

        return input;
      },
    });
  }, [store, reloadChats]);

  const selectChat = useCallback(
    async (chatId: string) => {
      if (chatId === activeChatIdRef.current) {
        return;
      }

      try {
        const chat = await getChat(chatId);

        if (!chat) {
          return;
        }

        activeChatIdRef.current = chat.id;
        setActiveChatId(chat.id);
        setActiveTitle(chat.title);
        setStore(buildStore(chat));
      } catch {
        // Leave the current chat open; the drawer shows a stale list.
      }
    },
    [activeChatIdRef, buildStore],
  );

  const newChat = useCallback(() => {
    activeChatIdRef.current = null;
    setActiveChatId(null);
    setActiveTitle("New session");
    setStore(buildStore(null));
  }, [buildStore]);

  // Load the chat list once signed in (the drawer + chat screen read it).
  useEffect(() => {
    if (getAuthCookie()) {
      void reloadChats();
    }
  }, [reloadChats]);

  const value = useMemo(
    () => ({
      store,
      activeChatId,
      activeTitle,
      chats,
      chatsLoading,
      hasMoreChats: cursor !== null,
      loadMoreChats,
      reloadChats,
      selectChat,
      newChat,
    }),
    [
      store,
      activeChatId,
      activeTitle,
      chats,
      chatsLoading,
      cursor,
      loadMoreChats,
      reloadChats,
      selectChat,
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
