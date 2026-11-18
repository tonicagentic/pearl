import { useMemo, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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
  events: eventsProp,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** When set, use these events instead of the active chat store (home list). */
  readonly events?: readonly ThreadTraceEvent[];
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const liveEvents = useEveEvents() as readonly ThreadTraceEvent[];
  const events = eventsProp ?? liveEvents;
  const trace = useMemo(() => threadTraceFromEvents(events), [events]);
  const empty =
    trace.totals.modelCalls === 0 && trace.tools.count === 0;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ backgroundColor, paddingTop: insets.top }}
      >
        <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-muted/60 active:opacity-80"
            onPress={onClose}
          >
            <Icon as={XIcon} className="size-5 text-foreground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            className="min-h-10 justify-center px-2"
            onPress={onClose}
          >
            <Text variant="label">Done</Text>
          </Pressable>
        </View>

        <View className="px-5 pb-4 pt-1">
          <Text variant="title" className="tracking-tight">
            Cost
          </Text>
          <Text variant="secondary" className="mt-1">
            Models and tools for this thread
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="gap-6 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row gap-3">
            <HeroStat
              label="Total"
              value={formatUsd(trace.grandCostUsd)}
              hint={
                trace.tools.count > 0
                  ? `models ${formatUsd(trace.totals.costUsd)} · tools ${formatUsd(trace.tools.costUsd)}`
                  : trace.grandCostUsd === null && !empty
                    ? "No cost reported"
                    : undefined
              }
            />
            <HeroStat
              label="Turns"
              value={String(trace.turns)}
              hint={`${String(trace.totals.modelCalls)} model · ${String(trace.tools.count)} tool`}
            />
          </View>

          <View className="flex-row gap-3">
            <QuietStat
              label="Input"
              value={formatTokens(trace.totals.inputTokens)}
              hint={
                trace.totals.cacheReadTokens > 0
                  ? `${formatTokens(trace.totals.cacheReadTokens)} cached`
                  : undefined
              }
            />
            <QuietStat
              label="Output"
              value={formatTokens(trace.totals.outputTokens)}
            />
          </View>

          {empty ? (
            <Text variant="body" tone="muted" className="px-1">
              No billed usage in this thread yet.
            </Text>
          ) : (
            <>
              {trace.tools.bySource.length > 0 ? (
                <Section title="By source">
                  {trace.tools.bySource.map((row, index) => (
                    <View
                      key={row.source}
                      className={`flex-row items-start justify-between gap-3 py-3 ${index === 0 ? "" : "border-t border-border/50"}`}
                    >
                      <View className="min-w-0 flex-1">
                        <Text variant="body" weight="medium" numberOfLines={1}>
                          {row.label}
                        </Text>
                        <Text
                          variant="caption"
                          className="mt-0.5 tabular-nums"
                        >
                          {row.count} {row.count === 1 ? "call" : "calls"}
                        </Text>
                      </View>
                      <Text variant="body" className="tabular-nums">
                        {formatUsd(row.costUsd)}
                      </Text>
                    </View>
                  ))}
                  {trace.totals.modelCalls > 0 ? (
                    <View className="flex-row items-start justify-between gap-3 border-t border-border/50 py-3">
                      <View className="min-w-0 flex-1">
                        <Text variant="body" weight="medium">
                          Models
                        </Text>
                        <Text
                          variant="caption"
                          className="mt-0.5 tabular-nums"
                        >
                          {trace.totals.modelCalls}{" "}
                          {trace.totals.modelCalls === 1 ? "call" : "calls"}
                        </Text>
                      </View>
                      <Text variant="body" className="tabular-nums">
                        {formatUsd(trace.totals.costUsd)}
                      </Text>
                    </View>
                  ) : null}
                </Section>
              ) : null}

              {trace.byModel.length > 0 ? (
                <Section title="By model">
                  {trace.byModel.map((row, index) => (
                    <View
                      key={row.label}
                      className={`flex-row items-start justify-between gap-3 py-3 ${index === 0 ? "" : "border-t border-border/50"}`}
                    >
                      <View className="min-w-0 flex-1">
                        <Text variant="body" weight="medium" numberOfLines={1}>
                          {row.label}
                        </Text>
                        <Text
                          variant="caption"
                          className="mt-0.5 tabular-nums"
                        >
                          {row.modelCalls} calls ·{" "}
                          {formatTokens(row.inputTokens)} in ·{" "}
                          {formatTokens(row.outputTokens)} out
                        </Text>
                      </View>
                      <Text variant="body" className="tabular-nums">
                        {formatUsd(row.costUsd)}
                      </Text>
                    </View>
                  ))}
                </Section>
              ) : null}

              <Section title="Trace">
                {trace.callTurns.map((turn) => (
                  <View key={turn.turnId ?? turn.label} className="mb-4 last:mb-0">
                    <Text
                      variant="caption"
                      weight="medium"
                      className="mb-2 uppercase tracking-wide"
                      numberOfLines={2}
                    >
                      {turn.label}
                    </Text>
                    {turn.calls.map((call, index) => (
                      <View
                        key={`${turn.turnId ?? "turn"}-model-${call.stepIndex ?? index}`}
                        className={`flex-row items-start justify-between gap-3 py-2.5 ${index === 0 ? "" : "border-t border-border/40"}`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text variant="body" numberOfLines={1}>
                            {call.modelId ?? "unknown"}
                          </Text>
                          <Text
                            variant="caption"
                            className="mt-0.5 tabular-nums"
                          >
                            {formatTokens(call.inputTokens ?? 0)} in ·{" "}
                            {formatTokens(call.outputTokens ?? 0)} out
                            {(call.cacheReadTokens ?? 0) > 0
                              ? ` · ${formatTokens(call.cacheReadTokens ?? 0)} cached`
                              : ""}
                          </Text>
                        </View>
                        <Text variant="secondary" className="tabular-nums">
                          {formatUsd(call.costUsd)}
                        </Text>
                      </View>
                    ))}
                    {turn.tools.map((tool, index) => (
                      <View
                        key={`${turn.turnId ?? "turn"}-tool-${tool.callId ?? index}`}
                        className={`flex-row items-start justify-between gap-3 py-2.5 ${turn.calls.length > 0 || index > 0 ? "border-t border-border/40" : ""}`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text variant="body" numberOfLines={1}>
                            {tool.label}
                          </Text>
                          {tool.detail ? (
                            <Text
                              variant="caption"
                              className="mt-0.5"
                              numberOfLines={1}
                            >
                              {tool.detail}
                            </Text>
                          ) : null}
                        </View>
                        <Text variant="secondary" className="tabular-nums">
                          {formatUsd(tool.costUsd)}
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
    </Modal>
  );
}

function HeroStat({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl bg-muted/40 px-4 py-3.5">
      <Text variant="caption" weight="medium">
        {label}
      </Text>
      <Text
        variant="title"
        className="mt-1 tabular-nums tracking-tight"
      >
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" className="mt-0.5">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function QuietStat({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <View className="min-w-0 flex-1 px-1 py-1">
      <Text variant="caption">{label}</Text>
      <Text variant="label" className="mt-0.5 tabular-nums">
        {value}
      </Text>
      {hint ? <Text variant="caption">{hint}</Text> : null}
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
      <Text variant="secondary" weight="medium" className="mb-2">
        {title}
      </Text>
      <View className="rounded-2xl bg-muted/30 px-4">{children}</View>
    </View>
  );
}
