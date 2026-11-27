import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { FinancesSubnav } from "@/components/finances/finances-subnav";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Text } from "@/components/ui/text";
import {
  fetchFinanceCategories,
  fetchFinancesTransactions,
  patchFinanceTransaction,
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

function moneyLabel(amount: number, amountLabel?: string) {
  if (amountLabel) return amountLabel;
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

/** Finances Sankey → filtered transaction list with categorize / clear. */
export function FinancesTransactionsScreen() {
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    year?: string;
    month?: string;
    categoryId?: string;
    groupId?: string;
    groupName?: string;
    accountId?: string;
    inboxOnly?: string;
    q?: string;
  }>();
  const { offline } = useNetworkStatus();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Partial<FinancesTransaction>>
  >({});
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const categoriesQuery = useQuery({
    queryKey: ["finances-categories"],
    queryFn: fetchFinanceCategories,
  });

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
      const accountId = firstParam(params.accountId);
      const inboxOnly = firstParam(params.inboxOnly);
      const q = firstParam(params.q);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (year) p.set("year", year);
      if (month) p.set("month", month);
      if (categoryId) p.set("categoryId", categoryId);
      if (groupId) p.set("groupId", groupId);
      if (groupName) p.set("groupName", groupName);
      if (accountId) p.set("accountId", accountId);
      if (inboxOnly) p.set("inboxOnly", inboxOnly);
      if (q) p.set("q", q);
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
      void categoriesQuery.refetch();
    }, [transactionsQuery.refetch, categoriesQuery.refetch]),
  );

  const items = useMemo(() => {
    const seen = new Set<string>();
    const merged: FinancesTransaction[] = [];
    for (const page of transactionsQuery.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push({ ...item, ...localOverrides[item.id] });
      }
    }
    return merged;
  }, [transactionsQuery.data?.pages, localOverrides]);

  const categories = useMemo(
    () =>
      (categoriesQuery.data?.groups ?? []).flatMap((g) => g.categories),
    [categoriesQuery.data],
  );

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

  const onClear = async (row: FinancesTransaction) => {
    setBusyId(row.id);
    try {
      const clear = row.status !== "cleared";
      await patchFinanceTransaction(row.id, { reconcile: clear });
      setLocalOverrides((prev) => ({
        ...prev,
        [row.id]: {
          status: clear ? "cleared" : row.category ? "categorized" : "inbox",
          reconciledAt: clear ? new Date().toISOString() : null,
        },
      }));
    } finally {
      setBusyId(null);
    }
  };

  const onCategorize = async (row: FinancesTransaction, categoryId: string) => {
    setBusyId(row.id);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      await patchFinanceTransaction(row.id, { categoryId });
      setLocalOverrides((prev) => ({
        ...prev,
        [row.id]: {
          category: cat
            ? { id: cat.id, name: cat.name, slug: cat.slug }
            : row.category,
          status: row.status === "cleared" ? "cleared" : "categorized",
        },
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenChrome title={title} leading="none">
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <FinancesSubnav />
      </View>
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
                gap: 8,
              }}
            >
              <View
                style={{
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
                    {item.status ? ` · ${item.status}` : ""}
                    {item.category?.name ? ` · ${item.category.name}` : ""}
                    {item.account?.name ? ` · ${item.account.name}` : ""}
                  </Text>
                </View>
                <Text variant="body" weight="medium">
                  {moneyLabel(item.amount, item.amountLabel)}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => void onClear(item)}
                    style={{
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text variant="caption">
                      {item.status === "cleared" ? "Uncleared" : "Clear"}
                    </Text>
                  </Pressable>
                  {categories.slice(0, 8).map((c) => (
                    <Pressable
                      key={c.id}
                      disabled={busyId === item.id}
                      onPress={() => void onCategorize(item, c.id)}
                      style={{
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        opacity: item.category?.id === c.id ? 1 : 0.7,
                      }}
                    >
                      <Text variant="caption">{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        />
      )}
    </ScreenChrome>
  );
}
