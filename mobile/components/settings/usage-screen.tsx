import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CoinsIcon,
  GaugeIcon,
} from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";
import {
  fetchUsageSummary,
  formatSpendUsd,
  formatTokens,
  formatUsd,
  type MobileUsageSummary,
  type UsageSourceRow,
  type UsageSummaryQuery,
} from "@/src/usage-client";

function formatPeriodChip(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type FilterChip = {
  readonly key: string;
  readonly label: string;
  readonly query: UsageSummaryQuery;
};

/**
 * Billed spend + model tokens/cost for the signed-in account, filterable by
 * billing cycle or recent date range.
 */
export function UsageScreen() {
  const [summary, setSummary] = useState<MobileUsageSummary | null>(null);
  const [query, setQuery] = useState<UsageSummaryQuery>({ preset: "cycle" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void fetchUsageSummary(query)
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
    }, [query]),
  );

  const chips = useMemo((): readonly FilterChip[] => {
    const base: FilterChip[] = [
      { key: "cycle", label: "This cycle", query: { preset: "cycle" } },
      { key: "7d", label: "7 days", query: { preset: "7d" } },
      { key: "30d", label: "30 days", query: { preset: "30d" } },
      { key: "all", label: "All time", query: { preset: "all" } },
    ];
    const currentStart = summary?.currentPeriod.start ?? null;
    const periodChips = (summary?.periods ?? [])
      .filter((period) => period.periodStart !== currentStart)
      .slice(0, 6)
      .map((period) => ({
        key: `period:${period.periodStart}`,
        label: formatPeriodChip(period.periodStart),
        query: { periodStart: period.periodStart },
      }));
    return [...base, ...periodChips];
  }, [summary?.currentPeriod.start, summary?.periods]);

  const activeKey = useMemo(() => {
    if (query.periodStart) return `period:${query.periodStart}`;
    if (query.preset) return query.preset;
    return summary?.filter.preset ?? "cycle";
  }, [query.periodStart, query.preset, summary?.filter.preset]);

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

  const models = summary?.models;
  const ledger = summary?.ledger;
  const hasModelUsage = (models?.totals.modelCalls ?? 0) > 0;
  const hasLedger = (ledger?.bySource.length ?? 0) > 0;

  return (
    <SheetScaffold>
      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => {
          const selected = chip.key === activeKey;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setQuery(chip.query)}
              className={
                selected
                  ? "rounded-full bg-foreground px-3.5 py-2"
                  : "rounded-full bg-muted px-3.5 py-2"
              }
            >
              <Text
                variant="secondary"
                weight="medium"
                className={selected ? "text-background" : undefined}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsCard>
        <View className="gap-3 px-4 py-4">
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-[10px] bg-muted">
              <Icon as={CoinsIcon} className="size-5 text-amber-500" />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="secondary">
                {summary?.filter.label ?? "Usage"}
              </Text>
              <Text variant="title" className="tabular-nums">
                {formatSpendUsd(
                  ledger?.totalUsd ?? (ledger?.totalCents ?? 0) / 100,
                )}
              </Text>
              <Text variant="caption" tone="muted">
                Billed spend
                {models?.totals.costUsd != null
                  ? ` · models ${formatUsd(models.totals.costUsd)}`
                  : ""}
              </Text>
            </View>
            {loading ? <ActivityIndicator /> : null}
          </View>

          <View className="flex-row gap-2">
            <StatPill
              icon={ArrowDownToLineIcon}
              label="Input"
              value={formatTokens(models?.totals.inputTokens ?? 0)}
              hint={
                (models?.totals.cacheReadTokens ?? 0) > 0
                  ? `${formatTokens(models?.totals.cacheReadTokens ?? 0)} cache`
                  : undefined
              }
            />
            <StatPill
              icon={ArrowUpFromLineIcon}
              label="Output"
              value={formatTokens(models?.totals.outputTokens ?? 0)}
            />
            <StatPill
              icon={GaugeIcon}
              label="Turns"
              value={String(models?.turns ?? 0)}
              hint={
                (models?.totals.modelCalls ?? 0) > 0
                  ? `${models?.totals.modelCalls} calls`
                  : undefined
              }
            />
          </View>
        </View>
      </SettingsCard>

      {!hasLedger && !hasModelUsage ? (
        <SettingsCard>
          <Text variant="body" tone="muted" className="px-4 py-4">
            No usage in this range.
          </Text>
        </SettingsCard>
      ) : null}

      {hasLedger ? (
        <Section title="By source">
          <View className="gap-0">
            {ledger!.bySource.map((row, index) => (
              <SourceRow
                key={row.source}
                row={row}
                showDivider={index > 0}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {hasModelUsage ? (
        <Section title="By model">
          <View className="gap-0">
            {models!.byModel.map((row, index) => (
              <View key={row.label}>
                {index > 0 ? <View className="ml-4 h-px bg-border" /> : null}
                <View className="gap-0.5 px-4 py-3">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text variant="body" className="min-w-0 flex-1" numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text variant="body" weight="medium" className="tabular-nums">
                      {formatUsd(row.costUsd)}
                    </Text>
                  </View>
                  <Text variant="caption" tone="muted" className="tabular-nums">
                    {formatTokens(row.inputTokens)} in ·{" "}
                    {formatTokens(row.outputTokens)} out · {row.modelCalls}{" "}
                    {row.modelCalls === 1 ? "call" : "calls"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {(models?.byDay.length ?? 0) > 0 ? (
        <Section title="By day">
          <View className="gap-0">
            {[...models!.byDay].reverse().map((row, index) => (
              <View key={row.day}>
                {index > 0 ? <View className="ml-4 h-px bg-border" /> : null}
                <View className="gap-0.5 px-4 py-3">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text variant="body">{row.day}</Text>
                    <Text variant="body" weight="medium" className="tabular-nums">
                      {formatUsd(row.costUsd)}
                    </Text>
                  </View>
                  <Text variant="caption" tone="muted" className="tabular-nums">
                    {formatTokens(row.inputTokens)} in ·{" "}
                    {formatTokens(row.outputTokens)} out
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </SheetScaffold>
  );
}

function SourceRow({
  row,
  showDivider,
}: {
  readonly row: UsageSourceRow;
  readonly showDivider: boolean;
}) {
  return (
    <View>
      {showDivider ? <View className="ml-4 h-px bg-border" /> : null}
      <View className="gap-0.5 px-4 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="body" className="min-w-0 flex-1">
            {row.label}
          </Text>
          <Text variant="body" weight="medium" className="tabular-nums">
            {formatSpendUsd(row.costUsd ?? row.costCents / 100)}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {row.provider} · {row.rateLabel}
        </Text>
        <Text variant="caption" tone="muted">
          {row.pricingNote}
        </Text>
        {row.subgroups.map((subgroup) => (
          <View
            key={subgroup.label}
            className="mt-1 flex-row items-start justify-between gap-3 pl-2"
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="caption" numberOfLines={1}>
                {subgroup.label}
              </Text>
              <Text variant="caption" tone="muted">
                {subgroup.rateLabel}
              </Text>
            </View>
            <Text variant="caption" className="tabular-nums">
              {formatSpendUsd(subgroup.costUsd ?? subgroup.costCents / 100)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatPill({
  icon,
  label,
  value,
  hint,
}: {
  readonly icon: typeof CoinsIcon;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-1 rounded-[10px] bg-muted/60 px-2.5 py-2">
      <View className="flex-row items-center gap-1">
        <Icon as={icon} className="size-3.5 text-muted-foreground" />
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </View>
      <Text variant="secondary" weight="semibold" className="tabular-nums">
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
