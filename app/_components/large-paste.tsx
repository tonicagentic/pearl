"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ClipboardEvent, ReactNode } from "react";

import {
  createPasteEntry,
  expandPastesForSend,
  formatCount,
  LARGE_PASTE_CHARS,
  LARGE_PASTE_MAX_CHARS,
  LARGE_PASTE_MAX_ENTRIES,
  type PendingPaste,
} from "@/lib/chat/large-paste";

type HeldPaste = {
  readonly id: string;
  readonly charCount: number;
};

type LargePasteContextValue = {
  /** Pass to `ComposerPrimitive.Input`'s onPaste on the main composer. */
  readonly onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Held pastes, in registration order (for composer chips). */
  readonly heldPastes: readonly HeldPaste[];
  /** Removes a held paste (chip X / Backspace). */
  readonly removePaste: (id: string) => void;
  /**
   * Appends held pastes as inline blocks to the outgoing message text and
   * consumes them; pass the expanded text to the runtime.
   */
  readonly expandForSend: (text: string) => {
    readonly text: string;
    readonly consumedIds: readonly string[];
  };
};

const LargePasteContext = createContext<LargePasteContextValue | null>(null);

export function LargePasteProvider({
  children,
  onError,
}: {
  readonly children: ReactNode;
  readonly onError?: (message: string) => void;
}) {
  // Held content lives in refs, not state: the runtime captures prepareSend
  // (and therefore expandForSend) once, so expansion must read current data
  // through refs instead of a render-scoped closure. State mirrors only the
  // chip metadata the composer UI renders.
  const contentRef = useRef(new Map<string, string>());
  const heldRef = useRef<readonly HeldPaste[]>([]);
  const counterRef = useRef(0);
  const [heldPastes, setHeldPastes] = useState<readonly HeldPaste[]>([]);

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

      event.preventDefault();

      if (pastedText.length > LARGE_PASTE_MAX_CHARS) {
        // Fail early with an explanation rather than late at the model call:
        // the outgoing message would exceed the context window.
        onError?.(
          `Pasted text is too large (${formatCount(pastedText.length)} characters). Split it into parts or attach it as a file.`,
        );
        return;
      }

      if (heldRef.current.length >= LARGE_PASTE_MAX_ENTRIES) {
        onError?.(
          `Too many held pastes (${String(LARGE_PASTE_MAX_ENTRIES)}). Send or remove one first.`,
        );
        return;
      }

      const entry = createPasteEntry((counterRef.current += 1), pastedText);
      contentRef.current.set(entry.id, pastedText);
      heldRef.current = [...heldRef.current, entry];
      setHeldPastes(heldRef.current);
    },
    [onError],
  );

  const removePaste = useCallback((id: string) => {
    contentRef.current.delete(id);
    heldRef.current = heldRef.current.filter((paste) => paste.id !== id);
    setHeldPastes(heldRef.current);
  }, []);

  const expandForSend = useCallback((text: string) => {
    const pastes: PendingPaste[] = heldRef.current.map((held) => ({
      charCount: held.charCount,
      content: contentRef.current.get(held.id) ?? "",
      id: held.id,
    }));

    const expanded = expandPastesForSend(text, pastes);

    if (expanded.consumedIds.length > 0) {
      for (const id of expanded.consumedIds) {
        contentRef.current.delete(id);
      }

      heldRef.current = [];
      setHeldPastes([]);
    }

    return expanded;
  }, []);

  const value = useMemo<LargePasteContextValue>(
    () => ({ onComposerPaste, expandForSend, removePaste, heldPastes }),
    [expandForSend, heldPastes, onComposerPaste, removePaste],
  );

  return <LargePasteContext.Provider value={value}>{children}</LargePasteContext.Provider>;
}

export function useLargePaste(): LargePasteContextValue {
  const context = useContext(LargePasteContext);

  if (!context) {
    throw new Error("useLargePaste must be used inside LargePasteProvider.");
  }

  return context;
}
