import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  chatIdFromNotificationResponse,
  installPushNotificationHandler,
  registerForPushNotifications,
  setActiveChatIdForPush,
} from "@/src/push-notifications";

/**
 * Registers the Expo push token after sign-in, opens the named chat when a
 * banner is tapped, and keeps the active-chat suppressor in sync so the open
 * thread does not get a redundant banner.
 */
export function PushNotificationsBridge() {
  const { signedIn, restoring } = useAuth();
  const { activeChatId, selectChat } = useChats();
  const router = useRouter();
  const selectChatRef = useRef(selectChat);
  selectChatRef.current = selectChat;

  useEffect(() => {
    installPushNotificationHandler();
  }, []);

  useEffect(() => {
    setActiveChatIdForPush(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (restoring || !signedIn) {
      return;
    }
    void registerForPushNotifications();
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
        router.navigate("/");
      }
    }

    const coldStart = Notifications.getLastNotificationResponse();
    if (coldStart) {
      void openFromNotification(coldStart).finally(() => {
        Notifications.clearLastNotificationResponse();
      });
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void openFromNotification(response);
      });

    return () => {
      subscription.remove();
    };
  }, [restoring, router, signedIn]);

  return null;
}
