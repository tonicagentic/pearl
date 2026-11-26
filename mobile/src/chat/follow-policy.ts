import type { SessionView } from "eve/events";
import { activeTurn } from "eve/events";

/**
 * Mobile followWhile: follow the root stream only while a parent turn is open
 * (including person-wait). Stricter than eve's followIdle:false recipe
 * (`!idle || activeTurn`) so orphan child tasks cannot keep the stream open.
 *
 * Note: AgentStreamFollower keeps refreshing admitted children while
 * observe() is held even after followWhile closes the root — release
 * observation when the turn settles (see observe-lifecycle).
 */
export function mobileFollowWhile(view: SessionView): boolean {
  return activeTurn(view) !== undefined;
}

/** True when the store should keep an observe() ref for live/child reads. */
export function shouldHoldObservation(view: SessionView): boolean {
  return mobileFollowWhile(view);
}
