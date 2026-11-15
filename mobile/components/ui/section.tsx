import type { ReactNode } from "react";
import { View } from "react-native";

import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";

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
      <Text variant="secondary" weight="medium" className="px-1">
        {title}
      </Text>
      <SettingsCard>{children}</SettingsCard>
    </View>
  );
}
