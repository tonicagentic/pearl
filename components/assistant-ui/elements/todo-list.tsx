"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

import {
  latestTodoSnapshot,
  todoProgress,
  type AgentTodo,
} from "@/lib/agent-todos";
import { cn } from "@/lib/utils";

function StatusMark({ status }: { readonly status: AgentTodo["status"] }) {
  if (status === "completed") {
    return (
      <CheckIcon
        aria-hidden
        className="text-foreground/55 mt-0.5 size-3.5 shrink-0"
      />
    );
  }
  if (status === "in_progress") {
    return (
      <Loader2Icon
        aria-hidden
        className="text-foreground/70 mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
      />
    );
  }
  if (status === "cancelled") {
    return (
      <span
        aria-hidden
        className="border-foreground/25 mt-1 size-3 shrink-0 rounded-full border border-dashed"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="border-foreground/35 mt-1 size-3 shrink-0 rounded-full border"
    />
  );
}

function TodoRow({ item }: { readonly item: AgentTodo }) {
  const done = item.status === "completed" || item.status === "cancelled";
  return (
    <li className="flex items-start gap-2">
      <StatusMark status={item.status} />
      <span
        className={cn(
          "min-w-0 flex-1 text-[13px] leading-5",
          done ? "text-muted-foreground line-through decoration-muted-foreground/70" : "text-foreground/90",
        )}
      >
        {item.content}
      </span>
      {item.priority === "high" && !done ? (
        <span className="text-foreground/45 pt-0.5 text-[11px] tracking-wide uppercase">
          High
        </span>
      ) : null}
    </li>
  );
}

export function TodoListCard({
  items,
  updating,
}: {
  readonly items: readonly AgentTodo[];
  readonly updating: boolean;
}) {
  const { completed, tracked } = todoProgress(items);
  const fraction = tracked === 0 ? 1 : completed / tracked;
  const countLabel =
    items.length === 0
      ? "Updating"
      : tracked === 0
        ? "Cleared"
        : `${completed} of ${tracked}`;

  return (
    <section
      aria-label={`To-dos, ${countLabel}`}
      className="border-border/60 bg-foreground/[0.02] w-full rounded-xl border px-3 py-2.5"
      data-slot="todo-list"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-foreground/80 text-[13px] font-medium">To-dos</h3>
        <p className="text-muted-foreground text-[12px] tabular-nums">
          {updating && items.length === 0 ? "Updating…" : countLabel}
        </p>
      </div>
      {tracked > 0 ? (
        <div
          aria-hidden
          className="bg-foreground/10 mt-2 h-0.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-foreground/55 h-full rounded-full"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item, index) => (
            <TodoRow item={item} key={`${index}-${item.content}`} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Checklist for the latest `todo` call on this assistant message. */
export function SessionTodoList() {
  // Select the parts array itself. Deriving the snapshot inside the selector
  // would return a new object every read and break useSyncExternalStore.
  const parts = useAuiState((state) => state.message.parts);
  const snapshot = latestTodoSnapshot(parts);
  if (!snapshot) return null;
  return <TodoListCard items={snapshot.items} updating={snapshot.updating} />;
}
