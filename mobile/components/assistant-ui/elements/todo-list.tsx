import { useEffect, useRef, useState } from "react";
import { CheckIcon, Loader2 } from "lucide-react-native";
import { useAuiState } from "@assistant-ui/react-native";
import { Platform, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  latestTodoSnapshot,
  todoProgress,
  type AgentTodo,
} from "../../../../lib/agent-todos";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  ShimmerLabel,
  stepEnter,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";

function StatusMark({
  status,
  justCompleted,
}: {
  readonly status: AgentTodo["status"];
  readonly justCompleted: boolean;
}) {
  const scale = useSharedValue(justCompleted ? 0.5 : 1);
  useEffect(() => {
    if (!justCompleted) return;
    scale.value = 0.5;
    scale.value = withTiming(1, { duration: 200 });
  }, [justCompleted, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  if (status === "completed") {
    return (
      <Animated.View style={style}>
        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-foreground/55" />
      </Animated.View>
    );
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
  return (
    <View className="mt-1 size-3 shrink-0 rounded-full border border-foreground/35" />
  );
}

function TodoRow({
  item,
  justCompleted,
}: {
  readonly item: AgentTodo;
  readonly justCompleted: boolean;
}) {
  const done = item.status === "completed" || item.status === "cancelled";
  return (
    <View className="flex-row items-start gap-2">
      <StatusMark status={item.status} justCompleted={justCompleted} />
      <Text
        variant="secondary"
        tone={done ? "muted" : "default"}
        className={cn("min-w-0 flex-1", done && "line-through opacity-90")}
      >
        {item.content}
      </Text>
      {item.priority === "high" && !done ? (
        <Text
          variant="caption"
          className="pt-0.5 uppercase tracking-wide opacity-45"
          tone="default"
        >
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
  const motion = useMotion();
  // Reanimated entering on Expo web drops the node out of flow and the reply
  // paints over the card — keep layout enter native-only; web uses CSS.
  const nativeMotion = motion && Platform.OS !== "web";
  const webMotion = motion && Platform.OS === "web";
  const { completed, tracked } = todoProgress(items);
  const fraction = tracked === 0 ? 1 : completed / tracked;
  const width = useSharedValue(Math.round(fraction * 100));
  const countLabel =
    items.length === 0
      ? "Updating"
      : tracked === 0
        ? "Cleared"
        : `${completed} of ${tracked}`;

  useEffect(() => {
    width.value = withTiming(Math.round(fraction * 100), { duration: 300 });
  }, [fraction, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const prevStatusRef = useRef<Map<string, AgentTodo["status"]>>(new Map());
  const [justCompleted, setJustCompleted] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    const newlyDone = new Set<string>();
    for (const item of items) {
      const key = item.content;
      const was = prev.get(key);
      if (item.status === "completed" && was && was !== "completed") {
        newlyDone.add(key);
      }
    }
    prevStatusRef.current = new Map(
      items.map((item) => [item.content, item.status]),
    );
    if (newlyDone.size === 0) return;
    setJustCompleted(newlyDone);
    const timer = setTimeout(() => setJustCompleted(new Set()), 400);
    return () => clearTimeout(timer);
  }, [items]);

  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      accessibilityLabel={`To-dos, ${updating && items.length === 0 ? "Updating" : countLabel}`}
      className={cn(
        "w-full rounded-xl border border-border/60 bg-foreground/[0.02] px-3 py-2.5",
        webMotion && "step-enter",
      )}
    >
      <View className="flex-row items-center justify-between gap-3">
        {updating ? (
          <ShimmerLabel
            active
            variant="secondary"
            className="opacity-80"
          >
            To-dos
          </ShimmerLabel>
        ) : (
          <Text variant="secondary" weight="medium" className="opacity-80">
            To-dos
          </Text>
        )}
        <Text variant="caption" className="tabular-nums">
          {updating && items.length === 0 ? "Updating…" : countLabel}
        </Text>
      </View>
      {tracked > 0 ? (
        <View className="mt-2 h-0.5 overflow-hidden rounded-full bg-foreground/10">
          <Animated.View
            className="h-full rounded-full bg-foreground/55"
            style={barStyle}
          />
        </View>
      ) : null}
      {items.length > 0 ? (
        <View className="mt-2 gap-1.5">
          {items.map((item, index) => (
            <Animated.View
              key={item.content}
              entering={
                nativeMotion
                  ? stepEnter.delay(Math.min(index, 6) * 40)
                  : undefined
              }
              className={webMotion ? "step-enter" : undefined}
              style={
                webMotion
                  ? { animationDelay: `${Math.min(index, 6) * 40}ms` }
                  : undefined
              }
            >
              <TodoRow
                item={item}
                justCompleted={justCompleted.has(item.content)}
              />
            </Animated.View>
          ))}
        </View>
      ) : updating ? (
        <View className="mt-2 gap-1.5">
          {[0, 1, 2].map((slot) => (
            <View
              key={`todo-skel-${slot}`}
              className="h-3.5 max-w-full rounded-full bg-foreground/8"
              style={{ width: `${72 - slot * 14}%`, opacity: 0.7 - slot * 0.15 }}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
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
