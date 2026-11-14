import type { ReactNode } from "react";
import { View } from "react-native";

/** Grouped card chrome used by Settings and plugin lists. */
export function SettingsCard({ children }: { readonly children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-[18px] bg-card">{children}</View>
  );
}
