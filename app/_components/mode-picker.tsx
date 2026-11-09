"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, ChevronDownIcon, ListTodoIcon, SparklesIcon } from "lucide-react";

import {
  getAgentMode,
  setAgentMode,
  subscribeAgentMode,
  type AgentMode,
} from "@/app/_components/agent-mode";
import { cn } from "@/lib/utils";

const MODES: readonly {
  readonly key: AgentMode;
  readonly label: string;
  readonly description: string;
  readonly icon: typeof SparklesIcon;
}[] = [
  {
    key: "agent",
    label: "Agent",
    description: "Research and carry out the work",
    icon: SparklesIcon,
  },
  {
    key: "plan",
    label: "Plan",
    description: "Draft a plan without acting",
    icon: ListTodoIcon,
  },
];

export function ComposerModePicker({ disabled = false }: { disabled?: boolean }) {
  const selectedKey = useSyncExternalStore(
    subscribeAgentMode,
    getAgentMode,
    getAgentMode,
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

  const selected = MODES.find((mode) => mode.key === selectedKey) ?? MODES[0];
  const Icon = selected.icon;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Mode: ${selected.label}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-3.5" />
        {selected.label}
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Mode"
          className="bg-popover border-border/60 absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border p-1 shadow-lg"
        >
          {MODES.map((mode) => {
            const active = mode.key === selected.key;
            const ModeIcon = mode.icon;
            return (
              <button
                key={mode.key}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  active ? "bg-muted/70" : "hover:bg-muted/50",
                )}
                onClick={() => {
                  setAgentMode(mode.key);
                  setOpen(false);
                }}
              >
                <ModeIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{mode.label}</span>
                  <span className="text-muted-foreground block text-xs">
                    {mode.description}
                  </span>
                </span>
                {active ? (
                  <CheckIcon className="text-foreground mt-0.5 size-3.5 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
