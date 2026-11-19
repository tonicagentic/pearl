import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { revealChatThread } from "@/components/chat-history-push";
import { useAuth } from "@/src/auth";
import { postMobileAttention } from "@/src/attention-client";
import { useChats } from "@/src/chat-context";
import {
  badgeFromNotificationData,
  chatIdFromNotificationData,
  chatIdFromNotificationResponse,
  getRegisteredPushToken,
  installPushNotificationHandler,
  presenceFromNotificationData,
  registerForPushNotifications,
  setAppIconBadge,
} from "@/src/push-notifications";

/** Expo Go lacks full push / Observe natives — skip registration there. */
const isExpoGo = Constants.appOwnership === "expo";

/** Keep server attention fresh while the app is foregrounded. */
const ATTENTION_HEARTBEAT_MS = 10_000;

/**
 * Registers the Expo push token after sign-in, opens the named chat when a
 * banner is tapped, applies silent presence patches + waiting badge, heartbeats
 * foreground attention for server-side alert gating, and resumes open/retained
 * stores from foreground pushes so the stream owns the update.
 */
export function PushNotificationsBridge() {
  const { signedIn, restoring } = useAuth();
  const {
    activeChatId,
    selectChat,
    patchChatPresence,
    resumeChatFromPush,
    chats,
    store,
  } = useChats();
  const selectChatRef = useRef(selectChat);
  selectChatRef.current = selectChat;
  const patchPresenceRef = useRef(patchChatPresence);
  patchPresenceRef.current = patchChatPresence;
  const resumeFromPushRef = useRef(resumeChatFromPush);
  resumeFromPushRef.current = resumeChatFromPush;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (isExpoGo) return;
    installPushNotificationHandler();
  }, []);

  useEffect(() => {
    if (isExpoGo || restoring || !signedIn) {
      return;
    }
    void registerForPushNotifications().then((token) => {
      if (!token || AppState.currentState !== "active") {
        return;
      }
      const chatId = activeChatIdRef.current;
      const sessionId =
        chatId && storeRef.current.snapshot.session?.sessionId
          ? storeRef.current.snapshot.session.sessionId
          : null;
      void postMobileAttention({
        clientKey: token,
        state: "active",
        chatId,
        sessionId,
      });
    });
  }, [restoring, signedIn]);

  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  // Foreground backstop from the loaded Recents page when the app activates.
  // Server pushes carry the absolute waiting count for background updates.
  useEffect(() => {
    if (restoring || !signedIn) {
      return;
    }

    const syncFromChats = () => {
      const waiting = chatsRef.current.reduce(
        (count, chat) =>
          count +
          (chat.presence === "waiting" || chat.waitingForInput ? 1 : 0),
        0,
      );
      void setAppIconBadge(waiting);
    };

    syncFromChats();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") syncFromChats();
    });
    return () => subscription.remove();
  }, [restoring, signedIn]);

  // Heartbeat so the server skips alert banners while this phone is open.
  // Chat switches must not post background first — that race would let a
  // settling turn banner while the user is still looking at the app.
  useEffect(() => {
    if (isExpoGo || restoring || !signedIn) {
      return;
    }

    const post = (state: "active" | "background") => {
      const clientKey = getRegisteredPushToken();
      if (!clientKey) {
        return;
      }
      const chatId = activeChatIdRef.current;
      const sessionId =
        chatId && storeRef.current.snapshot.session?.sessionId
          ? storeRef.current.snapshot.session.sessionId
          : null;
      void postMobileAttention({
        clientKey,
        state,
        chatId,
        sessionId,
      });
    };

    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        post("active");
        return;
      }
      // Skip inactive (Control Center / app switcher peek) so a settle mid-swipe
      // does not banner. True background is when the process leaves the screen.
      if (next === "background") {
        post("background");
      }
    };

    onChange(AppState.currentState);

    const subscription = AppState.addEventListener("change", onChange);
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        post("active");
      }
    }, ATTENTION_HEARTBEAT_MS);

    return () => {
      subscription.remove();
      clearInterval(timer);
      post("background");
    };
  }, [restoring, signedIn]);

  // Refresh chatId / sessionId on the live attention row without flipping state.
  useEffect(() => {
    if (isExpoGo || restoring || !signedIn) {
      return;
    }
    if (AppState.currentState !== "active") {
      return;
    }
    const clientKey = getRegisteredPushToken();
    if (!clientKey) {
      return;
    }
    const sessionId =
      activeChatId && store.snapshot.session?.sessionId
        ? store.snapshot.session.sessionId
        : null;
    void postMobileAttention({
      clientKey,
      state: "active",
      chatId: activeChatId,
      sessionId,
    });
  }, [restoring, signedIn, activeChatId, store]);

  useEffect(() => {
    if (restoring || !signedIn) {
      return;
    }

    async function openFromNotification(
      response: Notifications.NotificationResponse | null | undefined,
    ) {
      const chatId = chatIdFromNotificationResponse(response);
      if (!chatId) {
        return;
      }
      const opened = await selectChatRef.current(chatId);
      if (opened) {
        revealChatThread();
      }
    }

    const coldStart = Notifications.getLastNotificationResponse();
    if (coldStart) {
      void openFromNotification(coldStart).finally(() => {
        Notifications.clearLastNotificationResponse();
      });
    }

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void openFromNotification(response);
      });

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        const presence = presenceFromNotificationData(data);
        if (presence) {
          patchPresenceRef.current(presence.chatId, presence.presence);
        }
        const badge = badgeFromNotificationData(data);
        if (badge != null) {
          void setAppIconBadge(badge);
        }
        // Foreground: treat the push as a realtime nudge for open/retained stores.
        if (AppState.currentState === "active") {
          const chatId =
            presence?.chatId ?? chatIdFromNotificationData(data);
          if (chatId) {
            resumeFromPushRef.current(chatId);
          }
        }
      },
    );

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [restoring, signedIn]);

  return null;
}
