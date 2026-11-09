import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { getAuthCookie } from "./eve-transport";
import { registerPushToken, unregisterPushToken } from "./push-client";

/** Chat currently on screen — suppress banners for that session only. */
let activeChatIdForPush: string | null = null;
let registeredToken: string | null = null;
let handlerInstalled = false;

export function setActiveChatIdForPush(chatId: string | null) {
  activeChatIdForPush = chatId;
}

export function getRegisteredPushToken(): string | null {
  return registeredToken;
}

function chatIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const chatId = (data as { chatId?: unknown }).chatId;
  return typeof chatId === "string" && chatId.trim() ? chatId.trim() : null;
}

export function installPushNotificationHandler() {
  if (handlerInstalled) {
    return;
  }
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const chatId = chatIdFromNotificationData(
        notification.request.content.data,
      );
      const suppress =
        Boolean(chatId) && chatId === activeChatIdForPush;
      return {
        shouldPlaySound: !suppress,
        shouldSetBadge: !suppress,
        shouldShowBanner: !suppress,
        shouldShowList: !suppress,
      };
    },
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync("default", {
    name: "Pearl",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Ask for permission and upload the Expo push token. Safe to call repeatedly;
 * failures are swallowed so chat still works without notification access.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  installPushNotificationHandler();

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (typeof projectId !== "string" || !projectId) {
      return null;
    }

    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = push.data?.trim();
    if (!token) {
      return null;
    }

    await registerPushToken(token);
    registeredToken = token;
    return token;
  } catch {
    return null;
  }
}

/**
 * Remove this device's token from the server before the auth cookie is cleared.
 */
export async function unregisterForPushNotifications(
  credential?: string | null,
): Promise<void> {
  const token = registeredToken;
  if (!token) {
    return;
  }
  const auth = credential ?? getAuthCookie();
  registeredToken = null;
  try {
    await unregisterPushToken(token, auth);
  } catch {
    // Sign-out must continue even when the revoke call fails.
  }
}

export function chatIdFromNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  if (!response) {
    return null;
  }
  return chatIdFromNotificationData(response.notification.request.content.data);
}
