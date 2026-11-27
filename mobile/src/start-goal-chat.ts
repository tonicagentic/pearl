import { router } from "expo-router";

import {
  SET_NEW_GOAL_MESSAGE,
  setPendingSeedMessage,
} from "@/src/pending-seed-message";

type StartGoalChatDeps = {
  readonly isAnonymous: boolean;
  /** Prefer `startNewChatWithMessage` so seed is queued after the store swap. */
  readonly startNewChatWithMessage: (text: string) => void;
  readonly notifyChatSelectedFromDrawer: (opts: {
    readonly tab: "pearl";
  }) => void;
  readonly setActiveProjectId?: (projectId: string | null) => void;
  readonly projectId?: string | null;
  /** Optional life-area label for “I want to set a new {area} goal”. */
  readonly area?: string;
};

function goalSeedMessage(area?: string): string {
  const trimmed = area?.trim();
  if (trimmed) return `I want to set a new ${trimmed} goal`;
  return SET_NEW_GOAL_MESSAGE;
}

/**
 * Open a new Pearl chat and auto-send the Goals walkthrough opener.
 * Guests are sent to sign-in first (same as drawer New chat).
 */
export function startGoalChat(deps: StartGoalChatDeps): void {
  if (deps.isAnonymous) {
    router.push("/sign-in");
    return;
  }

  // newChat + seed in one shot (seed after store swap). newChat clears the
  // attached project, so re-attach afterward when filing on a project.
  deps.startNewChatWithMessage(goalSeedMessage(deps.area));
  if (deps.projectId && deps.setActiveProjectId) {
    deps.setActiveProjectId(deps.projectId);
  }
  deps.notifyChatSelectedFromDrawer({ tab: "pearl" });
  requestAnimationFrame(() => {
    router.navigate("/");
  });
}
