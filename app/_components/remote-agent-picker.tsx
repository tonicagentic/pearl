"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { BotIcon, CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  getConnectedAgentsCache,
  getRemoteAgentSelection,
  remoteAgentLabel,
  setConnectedAgentsCache,
  setRemoteAgentSelection,
  subscribeConnectedAgentsCache,
  subscribeRemoteAgentSelection,
} from "@/app/_components/remote-agent-selection";
import { useActiveCustomAgent } from "@/components/custom-agents/active-custom-agent-context";
import type { ConnectedAgentSummary } from "@/lib/connected-agents/types";
import { cn } from "@/lib/utils";

/**
 * Composer switcher for Pearl vs connected private eve agents. Hidden until
 * the user has at least one connection.
 */
export function ComposerRemoteAgentPicker({
  disabled = false,
  chatId,
}: {
  disabled?: boolean;
  chatId?: string | null;
}) {
  const params = useParams<{ id?: string }>();
  const resolvedChatId =
    chatId ?? (typeof params?.id === "string" ? params.id : null);
  const selectedId = useSyncExternalStore(
    subscribeRemoteAgentSelection,
    getRemoteAgentSelection,
    getRemoteAgentSelection,
  );
  const agents = useSyncExternalStore(
    subscribeConnectedAgentsCache,
    getConnectedAgentsCache,
    getConnectedAgentsCache,
  );
  const { agent: customAgent } = useActiveCustomAgent();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/connected-agents", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        agents: ConnectedAgentSummary[];
      };
      if (!signal?.aborted) setConnectedAgentsCache(data.agents);
    } catch {
      // Leave the cache as-is; picker stays hidden when empty.
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

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

  // Custom-agent threads stay on Pearl; hide the connected-agent switcher.
  if (customAgent || agents.length === 0) return null;

  const label = remoteAgentLabel(selectedId, agents);

  const select = (id: string | null) => {
    setRemoteAgentSelection(id);
    setOpen(false);
    if (resolvedChatId) {
      void fetch(`/api/chats/${encodeURIComponent(resolvedChatId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remoteAgentId: id }),
      }).catch(() => {
        // Selection still applies to this turn via clientContext.
      });
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Agent: ${label}`}
        disabled={disabled || loading}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <BotIcon className="size-3.5" />
        {label}
        <ChevronDownIcon
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Agents"
          className="bg-popover border-border/60 absolute bottom-full left-0 z-50 mb-2 max-h-[min(20rem,50vh)] w-64 overflow-y-auto rounded-xl border p-1 shadow-lg"
        >
          <AgentOption
            label="Pearl"
            detail="This Pearl agent"
            selected={selectedId === null}
            onSelect={() => select(null)}
          />
          {agents.map((agent) => (
            <AgentOption
              key={agent.id}
              label={agent.label}
              detail={new URL(agent.url).host}
              selected={selectedId === agent.id}
              onSelect={() => select(agent.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentOption({
  label,
  detail,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly detail: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
        selected && "bg-muted/70",
      )}
    >
      <CheckIcon
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {detail}
        </span>
      </span>
    </button>
  );
}
