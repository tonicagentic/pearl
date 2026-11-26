import type { SessionView } from "eve/events";
import { shouldHoldObservation } from "./follow-policy";

export type ObservationHandle = {
  stopObserving: (() => void) | null;
};

/**
 * Ensure SessionStore.observe() is active. Returns the stop handle to store
 * on the binding. Safe to call when already observing.
 */
export function ensureObservation(
  binding: ObservationHandle,
  observe: () => () => void,
): void {
  if (binding.stopObserving) return;
  binding.stopObserving = observe();
}

/**
 * Release observe() so AgentStreamFollower.abortAll runs (refcount → 0).
 * Call when the parent turn has settled; re-attach on send/resume.
 */
export function releaseObservation(binding: ObservationHandle): void {
  binding.stopObserving?.();
  binding.stopObserving = null;
}

/**
 * After a commit, hold or release observation from the latest view.
 * Never cancels a turn — only detaches local reads.
 */
export function syncObservationToView(
  binding: ObservationHandle,
  view: SessionView,
  observe: () => () => void,
): "held" | "released" {
  if (shouldHoldObservation(view)) {
    ensureObservation(binding, observe);
    return "held";
  }
  releaseObservation(binding);
  return "released";
}
