"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ClipboardEvent } from "react";
import { useAui } from "@assistant-ui/react";

import {
  composerMustHandlePaste,
  readClipboardPaste,
} from "@/lib/chat/clipboard-paste";
import {
  addHeldPaste,
  getHeldPastes,
  LARGE_PASTE_CHARS,
  removeHeldPaste,
  subscribeToHeldPastes,
} from "@/lib/chat/large-paste";

type LargePasteComposer = {
  /** Pass to `ComposerPrimitive.Input`'s onPaste on the main / edit composer. */
  readonly onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Held pastes, in registration order (for composer chips). */
  readonly heldPastes: ReturnType<typeof getHeldPastes>;
  /** Removes a held paste (chip × / Backspace). */
  readonly removePaste: (id: string) => void;
};

/**
 * Insert `insert` into the composer text at the textarea caret (or append
 * when selection info is unavailable).
 */
function insertComposerText(
  current: string,
  insert: string,
  target: EventTarget | null,
): string {
  if (!(target instanceof HTMLTextAreaElement)) {
    return current.length > 0 ? `${current}${insert}` : insert;
  }
  const start = target.selectionStart ?? current.length;
  const end = target.selectionEnd ?? current.length;
  return `${current.slice(0, start)}${insert}${current.slice(end)}`;
}

/**
 * Composer-side hooks over the module-level paste registry (see
 * lib/chat/large-paste.ts for why the registry is a module singleton and not
 * React state: the send path must see the exact pastes the composer handler
 * registered, across every component instance).
 *
 * Also owns file pastes that only appear on `clipboardData.items` (screenshots)
 * so they are attached before the built-in handler sees an empty `files` list,
 * and so a long-text `preventDefault` does not drop accompanying files.
 */
export function useLargePasteComposer(): LargePasteComposer {
  const aui = useAui();
  const heldPastes = useSyncExternalStore(
    subscribeToHeldPastes,
    getHeldPastes,
    getHeldPastes,
  );

  const onComposerPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const payload = readClipboardPaste(event.clipboardData);

      if (!composerMustHandlePaste(payload, LARGE_PASTE_CHARS)) {
        // Short text (or empty) with no files: leave the event alone so the
        // field inserts text, and the built-in handler can still see files
        // if any appear only on `clipboardData.files` after our read.
        // HTML/uri fallbacks that produced short text with no files need us
        // to insert because the browser may not insert `text/html` as plain.
        if (
          payload.text.length > 0 &&
          !(event.clipboardData?.getData("text/plain") ?? "").trim()
        ) {
          event.preventDefault();
          const current = aui.composer.getState().text ?? "";
          aui.composer.setText(
            insertComposerText(current, payload.text, event.target),
          );
        }
        return;
      }

      // Own the paste so files are not double-added by the built-in handler
      // and long text never lands in the composer field.
      event.preventDefault();

      for (const file of payload.files) {
        void aui.composer.addAttachment(file).catch(() => {
          // Runtime emits composer.attachmentAddError before rejecting.
        });
      }

      if (payload.text.length === 0) return;

      if (payload.text.length >= LARGE_PASTE_CHARS) {
        addHeldPaste(payload.text);
        return;
      }

      const current = aui.composer.getState().text ?? "";
      aui.composer.setText(
        insertComposerText(current, payload.text, event.target),
      );
    },
    [aui],
  );

  const removePaste = useCallback((id: string) => removeHeldPaste(id), []);

  return { onComposerPaste, heldPastes, removePaste };
}

export function useHeldLargePastes(): ReturnType<typeof getHeldPastes> {
  return useSyncExternalStore(subscribeToHeldPastes, getHeldPastes, getHeldPastes);
}
