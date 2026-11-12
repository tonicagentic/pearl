import { router } from "expo-router";

/**
 * Ensure the chat thread is visible (home is root; chat is `/chat`).
 */
export function revealChatThread() {
  router.navigate("/chat");
}
