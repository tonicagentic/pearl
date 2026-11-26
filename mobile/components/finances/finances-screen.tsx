import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { SpendSankey } from "@/components/finances/spend-sankey";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { fetchMonthSpendSummary } from "@/src/finances-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";
import { buildSpendSankeyGraph } from "@/src/spend-sankey";

function currentYearMonth(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

/** Drawer → Finances: month spend Sankey with drilldown. */
export function FinancesScreen() {
  const now = currentYearMonth();
  const { offline } = useNetworkStatus();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const summaryQuery = useQuery({
    queryKey: queryKeys.financesMonth(year, month),
    queryFn: () => fetchMonthSpendSummary({ year, month }),
    placeholderData: keepPreviousData,
  });

  useFocusEffect(
    useCallback(() => {
      void summaryQuery.refetch();
    }, [summaryQuery.refetch]),
  );

  const summary = summaryQuery.data;
  const loading = summaryQuery.isPending && summary === undefined;
  const showError =
    showQueryErrorBanner(offline, summaryQuery.error) && !summary;

  const graph = useMemo(
    () => (summary ? buildSpendSankeyGraph(summary) : null),
    [summary],
  );

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const nextDisabled =
    next.year > now.year ||
    (next.year === now.year && next.month > now.month);

  return (
    <ScreenChrome title="Finances" leading="drawer">
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => {
              setYear(prev.year);
              setMonth(prev.month);
            }}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor,
            }}
          >
            <Icon as={ChevronLeftIcon} className="size-4 text-foreground" />
          </Pressable>
          <Text variant="body" weight="semibold">
            {monthLabel(year, month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={nextDisabled}
            onPress={() => {
              if (nextDisabled) return;
              setYear(next.year);
              setMonth(next.month);
            }}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor,
              opacity: nextDisabled ? 0.35 : 1,
            }}
          >
            <Icon as={ChevronRightIcon} className="size-4 text-foreground" />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        ) : showError ? (
          <Pressable onPress={() => void summaryQuery.refetch()}>
            <Text variant="secondary" style={{ color: mutedColor }}>
              {queryErrorMessage(
                summaryQuery.error,
                "Failed to load finances.",
              )}
            </Text>
          </Pressable>
        ) : summary && graph ? (
          <View
            style={{
              borderWidth: 1,
              borderColor,
              borderRadius: 12,
              padding: 14,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text variant="secondary" tone="muted">
                Spend by category
              </Text>
              <Text variant="title" weight="semibold">
                {summary.totalSpentLabel}
              </Text>
            </View>
            <SpendSankey graph={graph} />
          </View>
        ) : summaryQuery.isFetching ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        ) : null}
      </ScrollView>
    </ScreenChrome>
  );
}