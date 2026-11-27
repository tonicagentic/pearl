import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { CostMeter } from "@/components/assistant-ui/elements/cost-meter";
import { QuotaBanner } from "@/components/assistant-ui/elements/quota-banner";
import { TraceWaterfall } from "@/components/assistant-ui/elements/trace-waterfall";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { fetchBillingStatus } from "@/src/billing-client";
import { useEveEvents } from "@/src/chat-context";
import {
  costMeterProps,
  formatUsd,
  quotaBannerProps,
  threadTraceFromEvents,
  type BillingStatusLike,
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const liveEvents = useEveEvents() as readonly ThreadTraceEvent[];
  const events = eventsProp ?? liveEvents;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [billing, setBilling] = useState<BillingStatusLike | null>(null);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    let cancelled = false;
    void fetchBillingStatus().then((next) => {
      if (!cancelled) setBilling(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const trace = useMemo(
    () => threadTraceFromEvents(events, { nowMs }),
    [events, nowMs],
  );
  const meter = useMemo(() => costMeterProps(trace), [trace]);
  const quota = useMemo(
    () => quotaBannerProps(billing, { nowMs }),
    [billing, nowMs],
  );
  const empty = trace.totals.modelCalls === 0 && trace.tools.count === 0;

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
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pb-10"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {empty ? (
            <View className="rounded-2xl border border-border bg-card px-3 py-4">
              <Text variant="secondary">
                No billed usage in this thread yet.
              </Text>
            </View>
          ) : (
            <>
              <CostMeter
                runCost={meter.runCost}
                sessionCost={meter.sessionCost}
                lines={meter.lines}
              />

              {trace.tools.bySource.length > 0 ? (
                <View className="gap-1.5 px-1">
                  {trace.tools.bySource.map((row) => (
                    <View
                      key={row.source}
                      className="flex-row items-baseline justify-between gap-3"
                    >
                      <Text
                        variant="secondary"
                        className="min-w-0 flex-1 text-sm"
                        numberOfLines={1}
                      >
                        {row.label} · {row.count}
                      </Text>
                      <Text
                        variant="secondary"
                        className="shrink-0 tabular-nums text-foreground/75"
                      >
                        {formatUsd(row.costUsd)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {trace.spans.length > 0 ? (
                <TraceWaterfall
                  spans={trace.spans}
                  totalMs={trace.totalMs}
                  visibleCount={trace.spans.length}
                />
              ) : null}
            </>
          )}

          {quota ? (
            <QuotaBanner
              used={quota.used}
              limit={quota.limit}
              unit={quota.unit}
              resetsIn={quota.resetsIn}
              upgradeLabel="Upgrade"
              onUpgrade={() => {
                onClose();
                router.push("/settings/billing");
              }}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
