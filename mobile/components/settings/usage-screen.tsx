import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { CoinsIcon } from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";
import {
  fetchUsageSummary,
  formatSpendCents,
  type MobileUsageSummary,
  type UsagePeriodRow,
} from "@/src/usage-client";

const SOURCE_LABELS: Record<string, string> = {
  model: "Models",
  web_search: "Web search",
  exa_agent: "Research",
  sandbox: "Sandboxes",
  image: "Images",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function formatPeriodStart(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Total spend across every billing period, with a per-period source breakdown.
 */
export function UsageScreen() {
  const [summary, setSummary] = useState<MobileUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void fetchUsageSummary()
        .then((next) => {
          if (cancelled) return;
          setSummary(next);
          setError(next ? null : "Could not load usage.");
        })
        .catch((cause) => {
          if (cancelled) return;
          setSummary(null);
          setError(
            cause instanceof Error ? cause.message : "Could not load usage.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (loading && !summary) {
    return (
      <SheetScaffold>
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      </SheetScaffold>
    );
  }

  if (error && !summary) {
    return (
      <SheetScaffold>
        <SettingsCard>
          <Text variant="body" tone="muted" className="px-4 py-4">
            {error}
          </Text>
        </SettingsCard>
      </SheetScaffold>
    );
  }

  const periods = summary?.periods ?? [];

  return (
    <SheetScaffold>
      <SettingsCard>
        <View className="flex-row items-center gap-3 px-4 py-4">
          <View className="size-9 items-center justify-center rounded-[10px] bg-muted">
            <Icon as={CoinsIcon} className="size-5 text-amber-500" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="secondary">Total spend</Text>
            <Text variant="title" className="tabular-nums">
              {formatSpendCents(summary?.totalCents ?? 0)}
            </Text>
          </View>
        </View>
      </SettingsCard>

      {periods.length === 0 ? (
        <SettingsCard>
          <Text variant="body" tone="muted" className="px-4 py-4">
            No usage yet.
          </Text>
        </SettingsCard>
      ) : (
        periods.map((period) => (
          <PeriodBlock key={period.periodStart} period={period} />
        ))
      )}
    </SheetScaffold>
  );
}

function PeriodBlock({ period }: { readonly period: UsagePeriodRow }) {
  return (
    <Section title={formatPeriodStart(period.periodStart)}>
      <View className="gap-0">
        <View className="flex-row items-center justify-between px-4 py-3.5">
          <Text variant="label">Spend</Text>
          <Text variant="label" weight="semibold" className="tabular-nums">
            {formatSpendCents(period.totalCents)}
          </Text>
        </View>
        {period.bySource.map((row) => (
          <View key={row.source}>
            <View className="ml-4 h-px bg-border" />
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text variant="body" tone="muted">
                {sourceLabel(row.source)}
              </Text>
              <Text variant="body" tone="muted" className="tabular-nums">
                {formatSpendCents(row.costCents)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
}
