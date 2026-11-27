import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { FinancesSubnav } from "@/components/finances/finances-subnav";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  fetchFinanceAccounts,
  fetchFinanceCategories,
  fetchUncleared,
  patchFinanceTransaction,
  reconcileFinanceAccount,
} from "@/src/finances-client";
import { useNetworkStatus } from "@/src/network-status";
import { queryErrorMessage, showQueryErrorBanner } from "@/src/query-client";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function FinancesReconcileScreen() {
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { offline } = useNetworkStatus();
  const [accountId, setAccountId] = useState(firstParam(params.accountId) ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const accountsQuery = useQuery({
    queryKey: ["finances-accounts"],
    queryFn: fetchFinanceAccounts,
  });
  const categoriesQuery = useQuery({
    queryKey: ["finances-categories"],
    queryFn: fetchFinanceCategories,
  });

  const effectiveAccountId =
    accountId ||
    accountsQuery.data?.accounts.find((a) => a.needsReconcile)?.id ||
    accountsQuery.data?.accounts[0]?.id ||
    "";

  const unclearedQuery = useQuery({
    queryKey: ["finances-uncleared", effectiveAccountId],
    queryFn: () => fetchUncleared(effectiveAccountId),
    enabled: Boolean(effectiveAccountId),
  });

  useFocusEffect(
    useCallback(() => {
      void accountsQuery.refetch();
      void categoriesQuery.refetch();
      if (effectiveAccountId) void unclearedQuery.refetch();
    }, [
      accountsQuery.refetch,
      categoriesQuery.refetch,
      unclearedQuery.refetch,
      effectiveAccountId,
    ]),
  );

  const account = useMemo(
    () =>
      accountsQuery.data?.accounts.find((a) => a.id === effectiveAccountId) ??
      null,
    [accountsQuery.data, effectiveAccountId],
  );

  const categories = useMemo(
    () =>
      (categoriesQuery.data?.groups ?? []).flatMap((g) =>
        g.categories.map((c) => ({ ...c, groupName: g.name })),
      ),
    [categoriesQuery.data],
  );

  const items = unclearedQuery.data?.items ?? [];

  return (
    <ScreenChrome>
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-10">
        <FinancesSubnav />
        <Text variant="title" className="mb-1">
          Reconcile
        </Text>
        <Text variant="body" tone="muted" className="mb-4">
          Categorize uncleared lines, then clear them.
        </Text>

        {(showQueryErrorBanner(
          offline,
          accountsQuery.error || unclearedQuery.error,
        ) ||
          error) && (
          <Text variant="body" className="mb-3 text-rose-600">
            {error ??
              queryErrorMessage(
                accountsQuery.error || unclearedQuery.error,
                "Could not load reconcile.",
              )}
          </Text>
        )}

        <View className="mb-4 gap-2 rounded-2xl border border-border p-4">
          <Text variant="label">Account</Text>
          {(accountsQuery.data?.accounts ?? []).map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setAccountId(a.id);
                setSelected(new Set());
              }}
              className="rounded-xl border border-border px-3 py-2"
            >
              <Text
                variant="body"
                weight={a.id === effectiveAccountId ? "medium" : "regular"}
              >
                {a.name}
                {a.needsReconcile ? ` (${a.unclearedCount})` : ""}
              </Text>
            </Pressable>
          ))}
          {account ? (
            <Text variant="caption" tone="muted">
              Statement {account.balanceLabel} · books {account.booksBalanceLabel}
            </Text>
          ) : null}
        </View>

        <View className="mb-3 flex-row flex-wrap gap-2">
          <Button
            label="Select categorized"
            variant="secondary"
            onPress={() =>
              setSelected(
                new Set(
                  items
                    .filter(
                      (i) => i.category && i.category.slug !== "uncategorized",
                    )
                    .map((i) => i.id),
                ),
              )
            }
          />
          <Button
            label={`Clear selected (${selected.size})`}
            loading={busy}
            onPress={() => {
              if (!effectiveAccountId || selected.size === 0) return;
              setBusy(true);
              setError(null);
              void reconcileFinanceAccount(effectiveAccountId, [...selected])
                .then((result) => {
                  const skipped = selected.size - result.updated;
                  if (skipped > 0) {
                    setError(
                      `Cleared ${result.updated}; skipped ${skipped}.`,
                    );
                  }
                  setSelected(new Set());
                  return Promise.all([
                    accountsQuery.refetch(),
                    unclearedQuery.refetch(),
                  ]);
                })
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : "Could not clear.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
        </View>

        {unclearedQuery.isPending && !unclearedQuery.data ? (
          <ActivityIndicator color={mutedColor} />
        ) : items.length === 0 ? (
          <Text variant="body" tone="muted">
            No uncleared transactions.
          </Text>
        ) : (
          items.map((row) => {
            const inbox =
              !row.category || row.category.slug === "uncategorized";
            return (
              <View
                key={row.id}
                className="mb-3 gap-2 rounded-2xl border border-border p-3"
              >
                <Pressable
                  onPress={() => {
                    if (inbox) return;
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    });
                  }}
                >
                  <Text variant="body" weight="medium">
                    {selected.has(row.id) ? "✓ " : ""}
                    {row.memo || "Untitled"}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {row.date.slice(0, 10)} · {row.amountLabel}
                    {inbox ? " · needs category" : ""}
                  </Text>
                </Pressable>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {categories.slice(0, 12).map((c) => (
                      <Pressable
                        key={c.id}
                        className="rounded-full border border-border px-3 py-1"
                        onPress={() => {
                          setBusy(true);
                          void patchFinanceTransaction(row.id, {
                            categoryId: c.id,
                          })
                            .then(() => unclearedQuery.refetch())
                            .catch((err) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not categorize.",
                              ),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        <Text variant="caption">{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenChrome>
  );
}
