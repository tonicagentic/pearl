import { useMemo, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
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
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const events = useEveEvents() as readonly ThreadTraceEvent[];
  const trace = useMemo(() => threadTraceFromEvents(events), [events]);
  const empty = trace.totals.modelCalls === 0;

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
            <Text className="text-[17px] font-medium text-foreground">Done</Text>
          </Pressable>
        </View>

        <View className="px-5 pb-4 pt-1">
          <Text className="text-[22px] font-semibold tracking-tight text-foreground">
            Cost
          </Text>
          <Text className="mt-1 text-[13px] leading-4 text-muted-foreground">
            Model usage for this thread
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
              value={formatUsd(trace.totals.costUsd)}
              hint={
                trace.totals.costUsd === null && !empty
                  ? "No cost reported"
                  : undefined
              }
            />
            <HeroStat
              label="Turns"
              value={String(trace.turns)}
              hint={`${String(trace.totals.modelCalls)} calls`}
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
            <Text className="px-1 text-[15px] leading-5 text-muted-foreground">
              No model calls in this thread yet.
            </Text>
          ) : (
            <>
              <Section title="By model">
                {trace.byModel.map((row, index) => (
                  <View
                    key={row.label}
                    className={`flex-row items-start justify-between gap-3 py-3 ${index === 0 ? "" : "border-t border-border/50"}`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-[15px] font-medium text-foreground"
                        numberOfLines={1}
                      >
                        {row.label}
                      </Text>
                      <Text className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {row.modelCalls} calls · {formatTokens(row.inputTokens)}{" "}
                        in · {formatTokens(row.outputTokens)} out
                      </Text>
                    </View>
                    <Text className="text-[15px] tabular-nums text-foreground">
                      {formatUsd(row.costUsd)}
                    </Text>
                  </View>
                ))}
              </Section>

              <Section title="Trace">
                {trace.callTurns.map((turn) => (
                  <View key={turn.turnId ?? turn.label} className="mb-4 last:mb-0">
                    <Text
                      className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground"
                      numberOfLines={2}
                    >
                      {turn.label}
                    </Text>
                    {turn.calls.map((call, index) => (
                      <View
                        key={`${turn.turnId ?? "turn"}-${call.stepIndex ?? index}`}
                        className={`flex-row items-start justify-between gap-3 py-2.5 ${index === 0 ? "" : "border-t border-border/40"}`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-[15px] text-foreground"
                            numberOfLines={1}
                          >
                            {call.modelId ?? "unknown"}
                          </Text>
                          <Text className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                            {formatTokens(call.inputTokens ?? 0)} in ·{" "}
                            {formatTokens(call.outputTokens ?? 0)} out
                            {(call.cacheReadTokens ?? 0) > 0
                              ? ` · ${formatTokens(call.cacheReadTokens ?? 0)} cached`
                              : ""}
                          </Text>
                        </View>
                        <Text className="text-[14px] tabular-nums text-muted-foreground">
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
      <Text className="text-[12px] font-medium text-muted-foreground">
        {label}
      </Text>
      <Text className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </Text>
      {hint ? (
        <Text className="mt-0.5 text-[11px] text-muted-foreground">{hint}</Text>
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
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-[17px] font-medium tabular-nums text-foreground">
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
      <Text className="mb-2 text-[13px] font-medium text-muted-foreground">
        {title}
      </Text>
      <View className="rounded-2xl bg-muted/30 px-4">{children}</View>
    </View>
  );
}
