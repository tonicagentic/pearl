import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";

export type CapabilityRow = {
  readonly label: string;
  readonly detail: string;
  readonly trailing?: string;
  readonly trailingAccent?: boolean;
  readonly onPress?: () => void;
};

export type CapabilitySection = {
  readonly title: string;
  readonly intro?: string;
  readonly rows: readonly CapabilityRow[];
};

/** Profile capability page in the same shape as Coder and Answers. */
export function CapabilityDetail({
  title,
  detail,
  body,
  mark,
  sections,
}: {
  readonly title: string;
  readonly detail: string;
  readonly body: string;
  readonly mark: ReactNode;
  readonly sections: readonly CapabilitySection[];
}) {
  return (
    <>
      <Stack.Screen options={{ title }} />
      <SheetScaffold>
        <View className="flex-row items-start gap-4 px-1">
          {mark}
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="title">{title}</Text>
            <Text variant="body" tone="muted">
              {detail}
            </Text>
          </View>
        </View>
        <Text variant="body" className="px-1">
          {body}
        </Text>
        {sections.map((section) => (
          <View key={section.title} className="gap-1.5">
            <Text variant="secondary" weight="medium" className="px-1">
              {section.title}
            </Text>
            {section.intro ? (
              <Text variant="secondary" className="px-1">
                {section.intro}
              </Text>
            ) : null}
            <SettingsCard>
              {section.rows.map((row, index) => (
                <CapabilityFact
                  key={row.label}
                  row={row}
                  showSeparator={index < section.rows.length - 1}
                />
              ))}
            </SettingsCard>
          </View>
        ))}
      </SheetScaffold>
    </>
  );
}

/** Colored tile the same size as a plugin mark. */
export function CapabilityMark({
  children,
  backgroundClassName,
}: {
  readonly children: ReactNode;
  readonly backgroundClassName: string;
}) {
  return (
    <View
      className={`size-14 items-center justify-center rounded-[16px] ${backgroundClassName}`}
    >
      {children}
    </View>
  );
}

function CapabilityFact({
  row,
  showSeparator,
}: {
  readonly row: CapabilityRow;
  readonly showSeparator: boolean;
}) {
  const body = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="label">{row.label}</Text>
        <Text variant="secondary" numberOfLines={3}>
          {row.detail}
        </Text>
      </View>
      {row.trailing ? (
        <Text
          variant="secondary"
          tone={row.trailingAccent ? "primary" : "muted"}
          weight="medium"
          className="max-w-[34%] text-right"
          numberOfLines={2}
        >
          {row.trailing}
        </Text>
      ) : null}
      <Text
        accessibilityElementsHidden={!row.onPress}
        importantForAccessibility={row.onPress ? "auto" : "no"}
        variant="title"
        tone="muted"
        weight="light"
        className={row.onPress ? "opacity-40" : "opacity-0"}
      >
        ›
      </Text>
    </View>
  );

  return (
    <View>
      {row.onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={row.label}
          className="active:bg-muted/80"
          onPress={row.onPress}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {showSeparator ? <View className="ml-4 h-px bg-border" /> : null}
    </View>
  );
}
