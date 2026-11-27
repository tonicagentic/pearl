import { router } from "expo-router";

import { setNewGoalSeedMessage } from "@/src/pending-seed-message";

type StartGoalChatDeps = {
  readonly isAnonymous: boolean;
  readonly newChat: () => void;
  readonly notifyChatSelectedFromDrawer: (opts: {
    readonly tab: "pearl";
  }) => void;
  readonly setActiveProjectId?: (projectId: string | null) => void;
  readonly projectId?: string | null;
  /** Optional life-area label for “I want to set a new {area} goal”. */
  readonly area?: string;
};

/**
 * Open a new Pearl chat and auto-send the Goals walkthrough opener.
 * Guests are sent to sign-in first (same as drawer New chat).
 */
export function startGoalChat(deps: StartGoalChatDeps): void {
  if (deps.isAnonymous) {
    router.push("/sign-in");
    return;
  }

  setNewGoalSeedMessage(deps.area);
  deps.newChat();
  if (deps.projectId && deps.setActiveProjectId) {
    deps.setActiveProjectId(deps.projectId);
  }
  deps.notifyChatSelectedFromDrawer({ tab: "pearl" });
  requestAnimationFrame(() => {
    router.navigate("/");
  });
}
