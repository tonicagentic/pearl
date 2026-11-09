import { CheckIcon, Loader2 } from "lucide-react-native";
import { useAuiState } from "@assistant-ui/react-native";
import { Text, View } from "react-native";

import {
  latestTodoSnapshot,
  todoProgress,
  type AgentTodo,
} from "../../../../lib/agent-todos";
import { cn } from "@/lib/utils";

function StatusMark({ status }: { readonly status: AgentTodo["status"] }) {
  if (status === "completed") {
    return <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-foreground/55" />;
  }
  if (status === "in_progress") {
    return (
      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-foreground/70" />
    );
  }
  if (status === "cancelled") {
    return (
      <View className="mt-1 size-3 shrink-0 rounded-full border border-dashed border-foreground/25" />
    );
  }
  return <View className="mt-1 size-3 shrink-0 rounded-full border border-foreground/35" />;
}

function TodoRow({ item }: { readonly item: AgentTodo }) {
  const done = item.status === "completed" || item.status === "cancelled";
  return (
    <View className="flex-row items-start gap-2">
      <StatusMark status={item.status} />
      <Text
        className={cn(
          "min-w-0 flex-1 text-[13px] leading-5",
          done ? "text-muted-foreground line-through" : "text-foreground/90",
        )}
      >
        {item.content}
      </Text>
      {item.priority === "high" && !done ? (
        <Text className="pt-0.5 text-[11px] uppercase tracking-wide text-foreground/45">
          High
        </Text>
      ) : null}
    </View>
  );
}

function TodoListCard({
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
    <View
      accessibilityLabel={`To-dos, ${updating && items.length === 0 ? "Updating" : countLabel}`}
      className="w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3 py-2.5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[13px] font-medium text-foreground/80">To-dos</Text>
        <Text className="text-[12px] tabular-nums text-muted-foreground">
          {updating && items.length === 0 ? "Updating…" : countLabel}
        </Text>
      </View>
      {tracked > 0 ? (
        <View className="mt-2 h-0.5 overflow-hidden rounded-full bg-foreground/10">
          <View
            className="h-full rounded-full bg-foreground/55"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </View>
      ) : null}
      {items.length > 0 ? (
        <View className="mt-2 gap-1.5">
          {items.map((item, index) => (
            <TodoRow item={item} key={`${index}-${item.content}`} />
          ))}
        </View>
      ) : null}
    </View>
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
