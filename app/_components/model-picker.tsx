"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/app/_components/model-selection";

// Composer model picker, following assistant-ui's composer-model-picker
// anatomy (assistant-ui.com/elements/composer-model-picker): a small pill in
// the composer's action row names the active model and opens a short list to
// switch it. The trigger and menu are fully controlled — neither closes
// itself, so outside pointer-downs and Escape are handled here.
export function ComposerModelPicker({ disabled = false }: { disabled?: boolean }) {
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    // The module state is identical on server and client (default until a
    // picker interaction), so the same getter serves as getServerSnapshot.
    getModelSelection,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected =
    COMPOSER_MODELS.find((model) => model.key === selectedKey) ??
    COMPOSER_MODELS[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model: ${selected.label}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        {selected.label}
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Model"
          className="bg-popover border-border/60 absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border p-1 shadow-lg"
        >
          {COMPOSER_MODELS.map((model) => {
            const isSelected = model.key === selected.key;
            return (
              <button
                key={model.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setModelSelection(model.key);
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-accent flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  isSelected && "bg-accent/60",
                )}
              >
                <span className="text-foreground font-medium">
                  {model.label}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {model.meta}
                </span>
                {isSelected ? (
                  <CheckIcon className="text-foreground size-3.5 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}