import { router } from "expo-router";

import type { ProjectEntryFrom } from "@/src/overview-ui";

export type RevealChatThreadOptions = {
  /** When set, /chat Back returns to this project and hides the history control. */
  readonly returnProjectId?: string;
  readonly entryFrom?: ProjectEntryFrom;
};

/**
 * Ensure the chat thread is visible (home is root; chat is `/chat`).
 * Pass `returnProjectId` when opening from a project so Back returns there.
 */
export function revealChatThread(options?: RevealChatThreadOptions) {
  const returnProjectId = options?.returnProjectId?.trim();
  if (!returnProjectId) {
    router.navigate("/chat");
    return;
  }
  const params = new URLSearchParams({
    returnProject: returnProjectId,
  });
  if (options?.entryFrom === "overview" || options?.entryFrom === "drawer") {
    params.set("from", options.entryFrom);
  }
  router.navigate(`/chat?${params.toString()}`);
}
