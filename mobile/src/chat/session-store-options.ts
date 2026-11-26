import type { SessionStoreInit } from "eve/client";
import { mobileFollowWhile } from "./follow-policy";

/** Shared SessionStore options for every Pearl mobile writer. */
export function mobileSessionStoreOptions(
  partial: Omit<SessionStoreInit, "followAgents" | "followWhile"> &
    Partial<Pick<SessionStoreInit, "followAgents" | "followWhile">>,
): SessionStoreInit {
  return {
    ...partial,
    followAgents: partial.followAgents ?? true,
    followWhile: partial.followWhile ?? mobileFollowWhile,
  };
}
