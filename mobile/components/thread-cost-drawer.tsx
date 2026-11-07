import { useMemo, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEveEvents } from "@/src/chat-context";
import {
  formatTokens,
  formatUsd,
  threadTraceFromEvents,
  type ThreadTraceEvent,
} from "@/src/thread-trace";

export function ThreadCostDrawer({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const events = useEveEvents() as readonly ThreadTraceEvent[];
  const trace = useMemo(() => threadTraceFromEvents(events), [events]);
  const empty = trace.totals.modelCalls === 0;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-foreground/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="flex-1"
          onPress={onClose}
        />
        <View
          className="max-h-[85%] rounded-t-2xl border-t border-border bg-background"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3">
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-lg font-semibold text-foreground">
                Thread cost
              </Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">
                Model-call cost for this thread, from the live event trace.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="min-h-11 justify-center px-1"
              onPress={onClose}
            >
              <Text className="text-base text-muted-foreground">Close</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerClassName="gap-5 pb-4"
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row flex-wrap gap-3">
              <StatTile
                label="Cost"
                value={formatUsd(trace.totals.costUsd)}
                hint={
                  trace.totals.costUsd === null && !empty
                    ? "no cost reported"
                    : undefined
                }
              />
              <StatTile
                label="Input"
                value={formatTokens(trace.totals.inputTokens)}
                hint={
                  trace.totals.cacheReadTokens > 0
                    ? `${formatTokens(trace.totals.cacheReadTokens)} from cache`
                    : undefined
                }
              />
              <StatTile
                label="Output"
                value={formatTokens(trace.totals.outputTokens)}
              />
              <StatTile
                label="Turns"
                value={String(trace.turns)}
                hint={`${String(trace.totals.modelCalls)} model calls`}
              />
            </View>

            {empty ? (
              <View className="rounded-xl border border-border bg-card px-3 py-4">
                <Text className="text-sm text-muted-foreground">
                  No model calls in this thread yet.
                </Text>
              </View>
            ) : (
              <>
                <Section title="By model">
                  {trace.byModel.map((row) => (
                    <View
                      key={row.label}
                      className="flex-row items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
                    >
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-sm font-medium text-foreground"
                          numberOfLines={1}
                        >
                          {row.label}
                        </Text>
                        <Text className="text-xs tabular-nums text-muted-foreground">
                          {row.modelCalls} calls · {formatTokens(row.inputTokens)}{" "}
                          in · {formatTokens(row.outputTokens)} out
                        </Text>
                      </View>
                      <Text className="text-sm tabular-nums text-muted-foreground">
                        {formatUsd(row.costUsd)}
                      </Text>
                    </View>
                  ))}
                </Section>

                <Section title="Trace">
                  {trace.callTurns.map((turn) => (
                    <View
                      key={turn.turnId ?? turn.label}
                      className="mb-3 overflow-hidden rounded-xl border border-border last:mb-0"
                    >
                      <View className="border-b border-border bg-muted/40 px-3 py-2">
                        <Text
                          className="text-xs font-medium text-muted-foreground"
                          numberOfLines={2}
                        >
                          {turn.label}
                        </Text>
                      </View>
                      {turn.calls.map((call, index) => (
                        <View
                          key={`${turn.turnId ?? "turn"}-${call.stepIndex ?? index}`}
                          className="flex-row items-start justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
                        >
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-sm font-medium text-foreground"
                              numberOfLines={1}
                            >
                              {call.modelId ?? "unknown"}
                            </Text>
                            <Text className="text-xs tabular-nums text-muted-foreground">
                              {formatTokens(call.inputTokens ?? 0)} in ·{" "}
                              {formatTokens(call.outputTokens ?? 0)} out
                              {(call.cacheReadTokens ?? 0) > 0
                                ? ` · ${formatTokens(call.cacheReadTokens ?? 0)} cached`
                                : ""}
                            </Text>
                          </View>
                          <Text className="text-sm tabular-nums text-muted-foreground">
                            {formatUsd(call.costUsd)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </Section>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 rounded-xl border border-border bg-card p-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </Text>
      {hint ? (
        <Text className="text-[11px] text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-foreground">{title}</Text>
      <View className="rounded-xl border border-border bg-card px-3">
        {children}
      </View>
    </View>
  );
}
