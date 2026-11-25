import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Text } from "@/components/ui/text";
import {
  fetchFinancesTransactions,
  type FinancesTransaction,
} from "@/src/finances-client";

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
  const [items, setItems] = useState<FinancesTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [title, setTitle] = useState("Transactions");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const payload = await fetchFinancesTransactions(buildParams());
      setItems(payload.items);
      setNextCursor(payload.nextCursor);
      const groupName = firstParam(params.groupName);
      const categoryId = firstParam(params.categoryId);
      if (groupName) setTitle(groupName);
      else if (categoryId) {
        setTitle(payload.items[0]?.category?.name ?? "Category");
      } else if (firstParam(params.groupId)) {
        setTitle(payload.items[0]?.category?.name ?? "Group");
      } else {
        setTitle("Transactions");
      }
    } catch (cause) {
      setItems([]);
      setNextCursor(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [buildParams, params.categoryId, params.groupId, params.groupName]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const payload = await fetchFinancesTransactions(buildParams(nextCursor));
      setItems((prev) => [...prev, ...payload.items]);
      setNextCursor(payload.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load more transactions.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, loadingMore, nextCursor]);

  return (
    <ScreenChrome title={title} leading="none">
      {loading && items.length === 0 ? (
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
      ) : error && items.length === 0 ? (
        <View style={{ padding: 16, backgroundColor }}>
          <Text variant="secondary" style={{ color: mutedColor }}>
            {error}
          </Text>
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
                onPress={() => void loadMore()}
                disabled={loadingMore}
                style={{ paddingVertical: 16, alignItems: "center" }}
              >
                {loadingMore ? (
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
