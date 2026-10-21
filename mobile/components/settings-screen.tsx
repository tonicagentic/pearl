import { useState, useSyncExternalStore } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CheckIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import {
  COMPOSER_MODELS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

export function SettingsScreen() {
  const { viewerEmail, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const backgroundColor = useCSSVariable("--color-background") as string | undefined;

  const selectModel = (key: string) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    void setModelSelection(key).catch(() => {
      setSaveError("Couldn't save this choice. Tap it again to retry.");
    }).finally(() => setSaving(false));
  };
  const confirmSignOut = () => {
    const complete = () => {
      signOut();
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out of Pearl?")) complete();
      return;
    }
    Alert.alert("Sign out of Pearl?", "You can sign in again to access your chats.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: complete },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["left", "right", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-7 px-5 pt-6 pb-8">
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</Text>
          <View className="rounded-2xl border border-border/60 bg-card px-4 py-3">
            <Text className="text-xs text-muted-foreground">Signed in as</Text>
            <Text className="mt-1 text-base text-foreground" selectable numberOfLines={2}>
              {viewerEmail ?? "Account"}
            </Text>
          </View>
        </View>
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chat</Text>
          <View className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <View className="border-b border-border/60 px-4 py-3">
              <Text className="text-base font-medium text-foreground">Default model</Text>
              <Text className="mt-1 text-xs text-muted-foreground">Used for new turns. You can also change it in the composer.</Text>
            </View>
            {COMPOSER_MODELS.map((model, index) => (
              <Pressable
                key={model.key}
                accessibilityRole="radio"
                accessibilityLabel={model.label}
                accessibilityState={{ checked: selectedKey === model.key, disabled: saving }}
                disabled={saving}
                className={`min-h-13 flex-row items-center justify-between px-4 active:bg-muted/60 ${index > 0 ? "border-t border-border/40" : ""}`}
                onPress={() => selectModel(model.key)}
              >
                <Text className="text-base text-foreground">{model.label}</Text>
                {selectedKey === model.key ? <CheckIcon className="size-5 text-foreground" /> : null}
              </Pressable>
            ))}
          </View>
          {saveError ? <Text className="px-1 text-sm text-destructive" accessibilityRole="alert">{saveError}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          className="min-h-13 justify-center rounded-2xl border border-border/60 bg-card px-4 active:bg-muted/60"
          onPress={confirmSignOut}
        >
          <Text className="text-base font-medium text-destructive">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
