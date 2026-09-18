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
  createAttachedPaste,
  expandLargePastes,
  LARGE_PASTE_MAX_ENTRIES,
  type LargePaste,
  type LargePasteRegistry,
} from "@/lib/chat/large-paste";

type LargePasteContextValue = {
  /** Pass to `ComposerPrimitive.Input`'s onPaste on the main composer. */
  readonly onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Expands placeholders for send; returns entries the user deleted. */
  readonly expandForSend: (text: string) => {
    readonly text: string;
    readonly removedIds: readonly string[];
  };
};

const LargePasteContext = createContext<LargePasteContextValue | null>(null);

// The provider sits above the assistant-ui runtime (the send path needs the
// expansion before the runtime exists in the tree), so the paste handler
// updates the controlled textarea through the native value setter — the same
// route React's onChange then takes into aui.composer.setText.
function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;

  nativeSetter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.setSelectionRange(value.length, value.length);
}

export function LargePasteProvider({ children }: { readonly children: ReactNode }) {
  // Registry outside React state: held paste content must not re-render the
  // composer tree, and the composer value itself lives in the runtime.
  const registryRef = useRef(new Map<string, LargePaste>());
  const counterRef = useRef(0);
  const [, setVersion] = useState(0);

  const onComposerPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";

      if (pastedText.length === 0) {
        // Files and other payloads fall through to the built-in handler.
        return;
      }

      const element = event.currentTarget;
      const nextIndex = (counterRef.current += 1);
      const attached = createAttachedPaste({
        composerText: element.value,
        selectionStart: element.selectionStart ?? element.value.length,
        selectionEnd: element.selectionEnd ?? element.value.length,
        pastedText,
        nextIndex,
      });

      if (!attached) {
        return;
      }

      event.preventDefault();

      if (registryRef.current.size >= LARGE_PASTE_MAX_ENTRIES) {
        const oldest = registryRef.current.keys().next().value;

        if (oldest !== undefined) {
          registryRef.current.delete(oldest);
        }
      }

      registryRef.current.set(attached.id, {
        id: attached.id,
        placeholder: attached.placeholder,
        content: attached.content,
        charCount: attached.content.length,
      });
      setVersion((v) => v + 1);
      setTextareaValue(element, attached.composerText);
    },
    [],
  );

  const expandForSend = useCallback((text: string) => {
    const expanded = expandLargePastes(
      text,
      registryRef.current as LargePasteRegistry,
    );

    // Placeholders the user deleted before sending drop their held content.
    for (const id of expanded.removedIds) {
      registryRef.current.delete(id);
      setVersion((v) => v + 1);
    }

    return expanded;
  }, []);

  const value = useMemo<LargePasteContextValue>(
    () => ({ onComposerPaste, expandForSend }),
    [expandForSend, onComposerPaste],
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
