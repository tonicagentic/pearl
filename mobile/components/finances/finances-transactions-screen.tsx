import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Text } from "@/components/ui/text";
import {
  fetchFinancesTransactions,
  type FinancesTransaction,
} from "@/src/finances-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function moneyLabel(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Finances Sankey → filtered transaction list. */
export function FinancesTransactionsScreen() {
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    year?: string;
    month?: string;
    categoryId?: string;
    groupId?: string;
    groupName?: string;
  }>();
  const { offline } = useNetworkStatus();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const buildParams = useCallback(
    (cursor?: string | null) => {
      const p = new URLSearchParams();
      const from = firstParam(params.from);
      const to = firstParam(params.to);
      const year = firstParam(params.year);
      const month = firstParam(params.month);
      const categoryId = firstParam(params.categoryId);
      const groupId = firstParam(params.groupId);
      const groupName = firstParam(params.groupName);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (year) p.set("year", year);
      if (month) p.set("month", month);
      if (categoryId) p.set("categoryId", categoryId);
      if (groupId) p.set("groupId", groupId);
      if (groupName) p.set("groupName", groupName);
      p.set("limit", "50");
      if (cursor) p.set("cursor", cursor);
      return p;
    },
    [params],
  );

  const paramsKey = buildParams().toString();

  const transactionsQuery = useInfiniteQuery({
    queryKey: queryKeys.financesTransactions(paramsKey),
    queryFn: ({ pageParam }) =>
      fetchFinancesTransactions(buildParams(pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useFocusEffect(
    useCallback(() => {
      void transactionsQuery.refetch();
    }, [transactionsQuery.refetch]),
  );

  const items = useMemo(() => {
    const seen = new Set<string>();
    const merged: FinancesTransaction[] = [];
    for (const page of transactionsQuery.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [transactionsQuery.data?.pages]);

  const title = useMemo(() => {
    const groupName = firstParam(params.groupName);
    const categoryId = firstParam(params.categoryId);
    if (groupName) return groupName;
    if (categoryId) {
      return items[0]?.category?.name ?? "Category";
    }
    if (firstParam(params.groupId)) {
      return items[0]?.category?.name ?? "Group";
    }
    return "Transactions";
  }, [items, params.groupId, params.groupName, params.categoryId]);

  const nextCursor =
    transactionsQuery.data?.pages.at(-1)?.nextCursor ?? null;
  const loading =
    transactionsQuery.isPending && transactionsQuery.data === undefined;
  const showError =
    showQueryErrorBanner(offline, transactionsQuery.error) &&
    items.length === 0;

  const loadMore = useCallback(() => {
    if (!nextCursor || transactionsQuery.isFetchingNextPage) return;
    void transactionsQuery.fetchNextPage();
  }, [nextCursor, transactionsQuery]);

  return (
    <ScreenChrome title={title} leading="none">
      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor,
          }}
        >
          <ActivityIndicator />
        </View>
      ) : showError ? (
        <View style={{ padding: 16, backgroundColor }}>
          <Pressable onPress={() => void transactionsQuery.refetch()}>
            <Text variant="secondary" style={{ color: mutedColor }}>
              {queryErrorMessage(
                transactionsQuery.error,
                "Failed to load transactions.",
              )}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor }}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ padding: 16 }}>
              <Text variant="secondary" tone="muted">
                No transactions in this filter.
              </Text>
            </View>
          }
          ListFooterComponent={
            nextCursor ? (
              <Pressable
                onPress={loadMore}
                disabled={transactionsQuery.isFetchingNextPage}
                style={{ paddingVertical: 16, alignItems: "center" }}
              >
                {transactionsQuery.isFetchingNextPage ? (
                  <ActivityIndicator />
                ) : (
                  <Text variant="secondary" weight="medium">
                    Load more
                  </Text>
                )}
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="body" weight="medium" numberOfLines={1}>
                  {item.memo?.trim() || "Untitled"}
                </Text>
                <Text variant="secondary" tone="muted" numberOfLines={1}>
                  {dayLabel(item.date)}
                  {item.category?.name ? ` · ${item.category.name}` : ""}
                  {item.account?.name ? ` · ${item.account.name}` : ""}
                </Text>
              </View>
              <Text variant="body" weight="medium">
                {moneyLabel(item.amount)}
              </Text>
            </View>
          )}
        />
      )}
    </ScreenChrome>
  );
}