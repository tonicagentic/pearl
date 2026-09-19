"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ClipboardEvent } from "react";

import {
  addHeldPaste,
  getHeldPastes,
  LARGE_PASTE_CHARS,
  removeHeldPaste,
  subscribeToHeldPastes,
} from "@/lib/chat/large-paste";

type LargePasteComposer = {
  /** Pass to `ComposerPrimitive.Input`'s onPaste on the main composer. */
  readonly onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Held pastes, in registration order (for composer chips). */
  readonly heldPastes: ReturnType<typeof getHeldPastes>;
  /** Removes a held paste (chip × / Backspace). */
  readonly removePaste: (id: string) => void;
};

/**
 * Composer-side hooks over the module-level paste registry (see
 * lib/chat/large-paste.ts for why the registry is a module singleton and not
 * React state: the send path must see the exact pastes the composer handler
 * registered, across every component instance).
 */
export function useLargePasteComposer(): LargePasteComposer {
  const heldPastes = useSyncExternalStore(
    subscribeToHeldPastes,
    getHeldPastes,
    getHeldPastes,
  );

  const onComposerPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";

      if (pastedText.length === 0) {
        // Files and other payloads fall through to the built-in handler.
        return;
      }

      if (pastedText.length < LARGE_PASTE_CHARS) {
        return;
      }

      // Keep the raw paste out of the composer text in every case: below the
      // cap it becomes a chip, above it the size error explains the refusal.
      event.preventDefault();
      addHeldPaste(pastedText);
    },
    [],
  );

  const removePaste = useCallback((id: string) => removeHeldPaste(id), []);

  return { onComposerPaste, heldPastes, removePaste };
}

export function useHeldLargePastes(): ReturnType<typeof getHeldPastes> {
  return useSyncExternalStore(subscribeToHeldPastes, getHeldPastes, getHeldPastes);
}
