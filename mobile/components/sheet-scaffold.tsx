import type { ReactNode } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

/**
 * Shared chrome for Settings form sheets. Native stack headers on formSheet
 * overlap scroll content on iOS, so these screens own the title and top inset
 * below the system grabber instead.
 */
export function SheetScaffold({
  title,
  children,
  footer,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-10"
        contentContainerStyle={{
          // Room under the form-sheet grabber before the title.
          paddingTop: Platform.OS === "ios" ? 12 : 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center pb-1 pt-1">
          <Text className="text-[17px] font-semibold text-foreground">
            {title}
          </Text>
        </View>
        {children}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}
