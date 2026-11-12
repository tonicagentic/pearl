import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

/**
 * Scroll body for stack screens that use the native header for the title.
 * Top safe-area keeps content clear of the status bar / notch when the
 * header does not already consume it; extra paddingTop avoids a flush first row.
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
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {children}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}
