import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { SettingsCard } from "@/components/ui/settings-card";

/**
 * Titled settings-style section: muted label + SettingsCard body.
 * Matches Plugins list section chrome.
 */
export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-medium text-muted-foreground">
        {title}
      </Text>
      <SettingsCard>{children}</SettingsCard>
    </View>
  );
}
