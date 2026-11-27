import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  ClockIcon,
  PlusIcon,
  ZapIcon,
  XIcon,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  deleteAutomationRequest,
  fetchAutomations,
  updateAutomationRequest,
  type AutomationDto,
} from "@/src/automations-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";

/** Automations list + Grok-style empty state. */
export function AutomationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { offline } = useNetworkStatus();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const muted = useCSSVariable("--color-muted") as string | undefined;
  const mutedFg = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;
  const border = useCSSVariable("--color-border") as string | undefined;
  const primary = useCSSVariable("--color-primary") as string | undefined;

  const listQuery = useQuery({
    queryKey: queryKeys.automations,
    queryFn: fetchAutomations,
  });

  useFocusEffect(
    useCallback(() => {
      void listQuery.refetch();
    }, [listQuery.refetch]),
  );

  const rows = listQuery.data ?? [];
  const loading = listQuery.isPending && !listQuery.data;
  const showError = showQueryErrorBanner(offline, listQuery.error);

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      updateAutomationRequest(input.id, { enabled: input.enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automations });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomationRequest(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automations });
    },
  });

  const openNew = () => router.push("/automations/new");
  const openEdit = (id: string) =>
    router.push(`/automations/edit?id=${encodeURIComponent(id)}`);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center justify-between px-4 pb-3"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.navigate("/");
          }}
          className="size-10 items-center justify-center rounded-full bg-muted"
        >
          <Icon as={XIcon} className="size-5 text-foreground" />
        </Pressable>
        <Text variant="title" className="text-[17px]">
          Automations
        </Text>
        <View className="size-10" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={mutedFg ?? undefined} />
        </View>
      ) : showError ? (
        <Pressable
          className="mx-5 mt-6 rounded-2xl bg-destructive/10 px-4 py-3"
          onPress={() => void listQuery.refetch()}
        >
          <Text tone="destructive">
            {queryErrorMessage(listQuery.error, "Failed to load automations.")}
          </Text>
          <Text variant="caption" tone="destructive" className="mt-1 opacity-80">
            Tap to retry
          </Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 pb-24">
          <View
            style={{ backgroundColor: muted ?? card }}
            className="mb-5 size-16 items-center justify-center rounded-full"
          >
            <View className="relative">
              <Icon as={ClockIcon} className="size-7 text-foreground" />
              <View className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                <Icon as={ZapIcon} className="size-3.5 text-foreground" />
              </View>
            </View>
          </View>
          <Text variant="title" className="mb-2 text-center text-[20px]">
            Start by adding an automation
          </Text>
          <Text
            variant="secondary"
            className="mb-8 text-center text-[15px] leading-5"
          >
            Schedule an automation to run any prompt and get reminded when it
            completes
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New Automation"
            onPress={openNew}
            className="flex-row items-center gap-2 rounded-full border px-5 py-3"
            style={{ borderColor: border ?? mutedFg }}
          >
            <Icon as={PlusIcon} className="size-4 text-foreground" />
            <Text className="font-medium text-foreground">New Automation</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 72,
          }}
        >
          {rows.map((row) => (
            <AutomationRow
              key={row.id}
              row={row}
              cardColor={card ?? muted}
              trackColor={primary}
              busy={
                toggleMutation.isPending || deleteMutation.isPending
              }
              onPress={() => openEdit(row.id)}
              onToggle={(enabled) =>
                toggleMutation.mutate({ id: row.id, enabled })
              }
              onDelete={() => {
                Alert.alert(
                  "Delete automation?",
                  `Remove “${row.name}”? This cannot be undone.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteMutation.mutate(row.id),
                    },
                  ],
                );
              }}
            />
          ))}
        </ScrollView>
      )}

      {rows.length > 0 ? (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 bottom-0 items-center"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New Automation"
            onPress={openNew}
            className="flex-row items-center gap-2 rounded-full border bg-background px-5 py-3"
            style={{ borderColor: border ?? mutedFg }}
          >
            <Icon as={PlusIcon} className="size-4 text-foreground" />
            <Text className="font-medium text-foreground">New Automation</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function AutomationRow({
  row,
  cardColor,
  trackColor,
  busy,
  onPress,
  onToggle,
  onDelete,
}: {
  readonly row: AutomationDto;
  readonly cardColor?: string;
  readonly trackColor?: string;
  readonly busy: boolean;
  readonly onPress: () => void;
  readonly onToggle: (enabled: boolean) => void;
  readonly onDelete: () => void;
}) {
  const [localEnabled, setLocalEnabled] = useState(row.enabled);
  useEffect(() => {
    setLocalEnabled(row.enabled);
  }, [row.enabled]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onDelete}
      className="mb-3 flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: cardColor }}
    >
      <View className="size-10 items-center justify-center rounded-full bg-muted">
        <Icon as={ZapIcon} className="size-5 text-foreground" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {row.name}
        </Text>
        <Text variant="caption" className="mt-0.5 text-muted-foreground" numberOfLines={2}>
          {row.scheduleSummary}
        </Text>
      </View>
      <Switch
        value={localEnabled}
        disabled={busy}
        onValueChange={(next) => {
          setLocalEnabled(next);
          onToggle(next);
        }}
        trackColor={{ false: undefined, true: trackColor ?? "#34C759" }}
      />
    </Pressable>
  );
}
