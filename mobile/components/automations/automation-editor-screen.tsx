import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  BellIcon,
  MailIcon,
  PlusIcon,
  ZapIcon,
  XIcon,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TriggerPickerModal } from "@/components/automations/trigger-picker";
import { Icon } from "@/components/ui/icon";
import { Text, TEXT_METRICS } from "@/components/ui/text";
import { formatScheduleSummary } from "../../../lib/automations/schedule";
import type {
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
} from "../../../lib/automations/types";
import {
  createAutomationRequest,
  deviceTimeZone,
  fetchAutomations,
  updateAutomationRequest,
} from "@/src/automations-client";
import {
  getPushPermissionStatus,
  requestPushNotificationPermission,
} from "@/src/push-notifications";
import { queryKeys } from "@/src/query-client";

/** New / edit automation form matching the Grok-style sheet. */
export function AutomationEditorScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === "string" ? params.id : null;
  const isEdit = Boolean(editId);

  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const muted = useCSSVariable("--color-muted") as string | undefined;
  const mutedFg = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;
  const border = useCSSVariable("--color-border") as string | undefined;
  const primary = useCSSVariable("--color-primary") as string | undefined;

  const listQuery = useQuery({
    queryKey: queryKeys.automations,
    queryFn: fetchAutomations,
    enabled: isEdit,
  });
  const existing = useMemo(
    () => listQuery.data?.find((row) => row.id === editId) ?? null,
    [editId, listQuery.data],
  );

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [triggerKind, setTriggerKind] =
    useState<PearlAutomationTriggerKind | null>(null);
  const [triggerConfig, setTriggerConfig] =
    useState<PearlAutomationTriggerConfig>({});
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<
    "granted" | "denied" | "undetermined" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const timezone = deviceTimeZone();

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setInstructions(existing.instructions);
    setTriggerKind(existing.triggerKind);
    setTriggerConfig(existing.triggerConfig);
    setNotifyPush(existing.notifyPush);
    setNotifyEmail(existing.notifyEmail);
  }, [existing]);

  useEffect(() => {
    void getPushPermissionStatus().then(setPushStatus);
  }, []);

  const canCreate =
    name.trim().length > 0 &&
    instructions.trim().length > 0 &&
    triggerKind !== null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!triggerKind) throw new Error("Add a trigger.");
      const body = {
        name: name.trim(),
        instructions: instructions.trim(),
        triggerKind,
        triggerConfig,
        timezone,
        notifyPush,
        notifyEmail,
        enabled: true,
      };
      if (isEdit && editId) {
        return updateAutomationRequest(editId, body);
      }
      return createAutomationRequest(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automations });
      router.back();
    },
    onError: (cause) => {
      setError(
        cause instanceof Error ? cause.message : "Could not save automation.",
      );
    },
  });

  const close = useCallback(() => {
    router.back();
  }, []);

  const showEnableNotifications =
    notifyPush && pushStatus !== null && pushStatus !== "granted";

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center justify-between px-4 pb-3"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          className="size-10 items-center justify-center rounded-full bg-muted"
        >
          <Icon as={XIcon} className="size-5 text-foreground" />
        </Pressable>
        <Text variant="title" className="text-[17px]">
          {isEdit ? "Edit Automation" : "New Automation"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "Save" : "Create"}
          disabled={!canCreate || saveMutation.isPending}
          onPress={() => {
            setError(null);
            saveMutation.mutate();
          }}
          className="min-h-10 min-w-16 items-center justify-center rounded-full px-3"
          style={{
            opacity: canCreate && !saveMutation.isPending ? 1 : 0.4,
            backgroundColor: canCreate ? (muted ?? undefined) : "transparent",
          }}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={foreground ?? undefined} />
          ) : (
            <Text
              className="font-semibold"
              style={{ color: canCreate ? foreground : mutedFg }}
            >
              {isEdit ? "Save" : "Create"}
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: showEnableNotifications
              ? 120
              : Math.max(insets.bottom, 24),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 items-center pt-2">
            <View
              style={{ backgroundColor: card ?? muted }}
              className="size-20 items-center justify-center rounded-3xl"
            >
              <Icon as={ZapIcon} className="size-9 text-foreground" />
            </View>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Automation Name"
            placeholderTextColor={mutedFg}
            className="mb-5 rounded-2xl px-4 py-3.5 text-[16px] text-foreground"
            style={{
              backgroundColor: card ?? muted,
              fontSize: TEXT_METRICS.body.fontSize,
              lineHeight: TEXT_METRICS.body.lineHeight,
              color: foreground,
            }}
          />

          <Text variant="caption" className="mb-2 px-1 text-muted-foreground">
            Trigger
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              triggerKind ? "Change trigger" : "Add trigger"
            }
            onPress={() => setPickerOpen(true)}
            className="mb-5 items-center justify-center rounded-2xl border border-dashed px-4 py-5"
            style={{
              borderColor: border ?? mutedFg,
              backgroundColor: "transparent",
            }}
          >
            {triggerKind ? (
              <View className="items-center gap-1">
                <Text className="font-semibold text-foreground">
                  {formatScheduleSummary(
                    triggerKind,
                    triggerConfig,
                    timezone,
                  )}
                </Text>
                <Text variant="caption" className="text-muted-foreground">
                  Tap to change
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Icon as={PlusIcon} className="size-4 text-foreground" />
                <Text className="font-medium text-foreground">Add Trigger</Text>
              </View>
            )}
          </Pressable>

          <Text variant="caption" className="mb-2 px-1 text-muted-foreground">
            Instructions
          </Text>
          <View
            className="mb-5 overflow-hidden rounded-2xl"
            style={{ backgroundColor: card ?? muted }}
          >
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Tell the agent what it should do"
              placeholderTextColor={mutedFg}
              multiline
              textAlignVertical="top"
              className="min-h-36 px-4 py-3.5 text-[16px] text-foreground"
              style={{
                color: foreground,
                fontSize: TEXT_METRICS.body.fontSize,
                lineHeight: TEXT_METRICS.body.lineHeight,
              }}
            />
          </View>

          <Text variant="caption" className="mb-2 px-1 text-muted-foreground">
            Notifications
          </Text>
          <View
            className="mb-4 overflow-hidden rounded-2xl"
            style={{ backgroundColor: card ?? muted }}
          >
            <NotifyRow
              icon={BellIcon}
              label="Push"
              value={notifyPush}
              onValueChange={setNotifyPush}
              trackColor={primary}
            />
            <View
              style={{ height: 1, backgroundColor: border ?? mutedFg, opacity: 0.3 }}
            />
            <NotifyRow
              icon={MailIcon}
              label="Email"
              value={notifyEmail}
              onValueChange={setNotifyEmail}
              trackColor={primary}
            />
          </View>

          {error ? (
            <Text variant="secondary" tone="destructive" className="mb-3 px-1">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {showEnableNotifications ? (
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: card ?? muted,
          }}
          className="absolute inset-x-0 bottom-0 border-t border-border px-4 pt-3"
        >
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl px-1 py-2"
            onPress={() => {
              if (pushStatus === "denied") {
                Alert.alert(
                  "Notifications are off",
                  "Enable Pearl notifications in iOS Settings → Pearl.",
                );
                return;
              }
              void requestPushNotificationPermission().then(setPushStatus);
            }}
          >
            <View className="size-10 items-center justify-center rounded-full bg-muted">
              <Icon as={BellIcon} className="size-5 text-foreground" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold">Enable Notifications</Text>
              <Text variant="caption" className="text-muted-foreground">
                Get reminded when this automation finishes
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <TriggerPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(kind) => {
          setTriggerKind(kind);
          setTriggerConfig({});
        }}
      />
    </View>
  );
}

function NotifyRow({
  icon: Glyph,
  label,
  value,
  onValueChange,
  trackColor,
}: {
  readonly icon: typeof BellIcon;
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (next: boolean) => void;
  readonly trackColor?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Icon as={Glyph} className="size-5 text-muted-foreground" />
      <Text className="flex-1 text-[16px]">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: undefined,
          true: trackColor ?? "#34C759",
        }}
      />
    </View>
  );
}
