"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Server + hydration snapshot is always false so SSR markup matches the first client paint. */
function getServerSnapshot() {
  return false;
}

/**
 * Reduced-motion preference that is safe for SSR. Returns false until after
 * hydration, then the real preference — same pattern as x.ai's hero skip flag.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
