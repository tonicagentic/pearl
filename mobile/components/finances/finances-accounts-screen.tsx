import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { FinancesSubnav } from "@/components/finances/finances-subnav";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  createFinanceCategory,
  createFinanceCategoryGroup,
  fetchFinanceCategories,
  patchFinanceCategory,
} from "@/src/finances-client";
import { useNetworkStatus } from "@/src/network-status";
import { queryErrorMessage, showQueryErrorBanner } from "@/src/query-client";

export function FinancesAccountsScreen() {
  const { offline } = useNetworkStatus();
  const [newGroupName, setNewGroupName] = useState("");
  const [newCategoryByGroup, setNewCategoryByGroup] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const categoriesQuery = useQuery({
    queryKey: ["finances-categories"],
    queryFn: fetchFinanceCategories,
  });

  useFocusEffect(
    useCallback(() => {
      void categoriesQuery.refetch();
    }, [categoriesQuery.refetch]),
  );

  const groups = categoriesQuery.data?.groups ?? [];

  return (
    <ScreenChrome>
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-10">
        <FinancesSubnav />
        <Text variant="title" className="mb-1">
          Chart of accounts
        </Text>
        <Text variant="body" tone="muted" className="mb-4">
          Groups and categories for spend.
        </Text>

        {(showQueryErrorBanner(offline, categoriesQuery.error) || error) && (
          <Text variant="body" className="mb-3 text-rose-600">
            {error ??
              queryErrorMessage(
                categoriesQuery.error,
                "Could not load categories.",
              )}
          </Text>
        )}

        <View className="mb-4 gap-2 rounded-2xl border border-border p-4">
          <Text variant="label">Add group</Text>
          <TextInput
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="Group name"
            className="rounded-xl border border-border px-3 py-2 text-base text-foreground"
            placeholderTextColor={mutedColor}
          />
          <Button
            label="Add group"
            loading={busy === "group"}
            onPress={() => {
              const name = newGroupName.trim();
              if (!name) return;
              setBusy("group");
              setError(null);
              void createFinanceCategoryGroup({ name })
                .then(() => {
                  setNewGroupName("");
                  return categoriesQuery.refetch();
                })
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : "Could not create group.",
                  ),
                )
                .finally(() => setBusy(null));
            }}
          />
        </View>

        {categoriesQuery.isPending && !categoriesQuery.data ? (
          <ActivityIndicator color={mutedColor} />
        ) : groups.length === 0 ? (
          <Text variant="body" tone="muted">
            No groups yet.
          </Text>
        ) : (
          groups.map((group) => (
            <View
              key={group.id}
              className="mb-4 gap-2 rounded-2xl border border-border p-4"
            >
              <Text variant="label">{group.name}</Text>
              {group.categories.map((cat) => (
                <View
                  key={cat.id}
                  className="flex-row items-center justify-between gap-2 border-t border-border pt-2"
                >
                  <View className="min-w-0 flex-1">
                    <Text variant="body">{cat.name}</Text>
                    <Text variant="caption" tone="muted">
                      {cat.monthActualLabel}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setBusy(`c:${cat.id}`);
                      void patchFinanceCategory(cat.id, { isArchived: true })
                        .then(() => categoriesQuery.refetch())
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not archive.",
                          ),
                        )
                        .finally(() => setBusy(null));
                    }}
                  >
                    <Text variant="caption" tone="muted">
                      Archive
                    </Text>
                  </Pressable>
                </View>
              ))}
              <TextInput
                value={newCategoryByGroup[group.id] ?? ""}
                onChangeText={(text) =>
                  setNewCategoryByGroup((d) => ({ ...d, [group.id]: text }))
                }
                placeholder="New category"
                className="mt-2 rounded-xl border border-border px-3 py-2 text-base text-foreground"
                placeholderTextColor={mutedColor}
              />
              <Button
                label="Add category"
                variant="secondary"
                loading={busy === `add:${group.id}`}
                onPress={() => {
                  const name = (newCategoryByGroup[group.id] ?? "").trim();
                  if (!name) return;
                  setBusy(`add:${group.id}`);
                  void createFinanceCategory({ name, groupId: group.id })
                    .then(() => {
                      setNewCategoryByGroup((d) => ({ ...d, [group.id]: "" }));
                      return categoriesQuery.refetch();
                    })
                    .catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not create category.",
                      ),
                    )
                    .finally(() => setBusy(null));
                }}
              />
            </View>
          ))
        )}
      </ScrollView>
    </ScreenChrome>
  );
}
