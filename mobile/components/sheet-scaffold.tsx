import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

/**
 * Scroll body for stack screens that use the native header for the title.
 * The header already clears the status bar; keep a top pad so the first row
 * is not flush, and let iOS adjust content insets automatically.
 */
export function SheetScaffold({
  children,
  footer,
}: {
  /** @deprecated Native stack header owns the title. */
  readonly title?: string;
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
        contentContainerStyle={{ paddingTop: 12 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {children}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}
