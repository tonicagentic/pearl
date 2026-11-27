"use client";

import {
  useRef,
  type ComponentProps,
  type FocusEvent,
} from "react";
import { useIsomorphicLayoutEffect } from "../utils/useIsomorphicLayoutEffect";

type FocusHandlers = Pick<
  ComponentProps<"div">,
  "onFocusCapture" | "onBlurCapture"
>;

/** Keeps focus on a receipt when the focused answer control is replaced. */
export function useReceiptFocus(handlers: FocusHandlers = {}) {
  const focusedElementRef = useRef<HTMLElement | null>(null);
  const receiptRef = useRef<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const focusedElement = focusedElementRef.current;
    if (focusedElement && !focusedElement.isConnected) {
      focusedElementRef.current = null;
      if (
        focusedElement.ownerDocument.activeElement ===
        focusedElement.ownerDocument.body
      ) {
        receiptRef.current?.focus({ preventScroll: true });
      }
    }
  });

  return {
    receiptRef,
    focusHandlers: {
      onFocusCapture: (event: FocusEvent<HTMLDivElement>) => {
        handlers.onFocusCapture?.(event);
        focusedElementRef.current = event.target as HTMLElement;
      },
      onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
        handlers.onBlurCapture?.(event);
        if (
          event.target.isConnected &&
          !event.currentTarget.contains(
            (event.relatedTarget as Node | null) ??
              event.currentTarget.ownerDocument.activeElement,
          )
        ) {
          focusedElementRef.current = null;
        }
      },
    } satisfies FocusHandlers,
  };
}
