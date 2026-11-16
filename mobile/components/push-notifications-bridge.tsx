import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { revealChatThread } from "@/components/chat-history-push";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  badgeFromNotificationData,
  chatIdFromNotificationResponse,
  installPushNotificationHandler,
  presenceFromNotificationData,
  registerForPushNotifications,
  setActiveChatIdForPush,
  setAppIconBadge,
} from "@/src/push-notifications";

/** Expo Go lacks full push / Observe natives — skip registration there. */
const isExpoGo = Constants.appOwnership === "expo";

/**
 * Registers the Expo push token after sign-in, opens the named chat when a
 * banner is tapped, applies silent presence patches + waiting badge, and
 * keeps the active-chat suppressor in sync so the open thread does not get a
 * redundant banner.
 */
export function PushNotificationsBridge() {
  const { signedIn, restoring } = useAuth();
  const { activeChatId, selectChat, patchChatPresence, chats } = useChats();
  const selectChatRef = useRef(selectChat);
  selectChatRef.current = selectChat;
  const patchPresenceRef = useRef(patchChatPresence);
  patchPresenceRef.current = patchChatPresence;

  useEffect(() => {
    if (isExpoGo) return;
    installPushNotificationHandler();
  }, []);

  useEffect(() => {
    setActiveChatIdForPush(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (isExpoGo || restoring || !signedIn) {
      return;
    }
    void registerForPushNotifications();
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
      },
    );

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [restoring, signedIn]);

  return null;
}
