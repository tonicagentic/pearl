import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { SheetScaffold } from "@/components/sheet-scaffold";
import { useAuth } from "@/src/auth";
import {
  COMPOSER_MODELS,
  getModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

export function SettingsScreen() {
  const { viewerEmail, signOut } = useAuth();
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const selectedLabel =
    COMPOSER_MODELS.find((model) => model.key === selectedKey)?.label ??
    selectedKey;
  const confirmSignOut = () => {
    const complete = () => {
      signOut();
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out of Pearl?")) {
        complete();
      }
      return;
    }
    Alert.alert("Sign out of Pearl?", "You can sign in again to access your chats.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: complete },
    ]);
  };

  return (
    <SheetScaffold title="Settings">
      <SettingsGroup label="Account">
        <View style={styles.row}>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[13px] text-muted-foreground">
              Signed in as
            </Text>
            <Text
              className="text-[17px] leading-[22px] text-foreground"
              numberOfLines={2}
              selectable
            >
              {viewerEmail ?? "Account"}
            </Text>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup label="You">
        <SettingsLink
          detail="Name, body, health, home"
          label="Identity"
          onPress={() => router.push("/identity")}
        />
      </SettingsGroup>

      <SettingsGroup label="Agent">
        <SettingsLink
          detail={selectedLabel}
          label="Models"
          onPress={() => router.push("/models")}
          showSeparator
        />
        <SettingsLink
          detail="Google, GitHub, Vercel, and more"
          label="Plugins"
          onPress={() => router.push("/plugins")}
          showSeparator
        />
        <SettingsLink
          detail="Custom and published skills"
          label="Skills"
          onPress={() => router.push("/skills")}
        />
      </SettingsGroup>

      <View className="overflow-hidden rounded-[10px] bg-card">
        <Pressable
          accessibilityRole="button"
          className="active:bg-muted/80"
          onPress={confirmSignOut}
          style={styles.row}
        >
          <Text className="text-[17px] leading-[22px] text-destructive">
            Sign out
          </Text>
        </Pressable>
      </View>
    </SheetScaffold>
  );
}

function SettingsGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </Text>
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
    </View>
  );
}

function SettingsLink({
  label,
  detail,
  onPress,
  showSeparator,
}: {
  readonly label: string;
  readonly detail: string;
  readonly onPress: () => void;
  readonly showSeparator?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        className="active:bg-muted/80"
        onPress={onPress}
        style={styles.row}
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[17px] leading-[22px] text-foreground">
            {label}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text className="text-[20px] font-light text-muted-foreground/40">
          ›
        </Text>
      </Pressable>
      {showSeparator ? (
        <View className="ml-4 h-px bg-border" style={styles.separatorHairline} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separatorHairline: {
    height: StyleSheet.hairlineWidth,
  },
});
