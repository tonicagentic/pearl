import type { ReactNode } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

/**
 * Scroll body for stack screens that use the native header for the title.
 * The header already clears the status bar; keep a top pad so the first row
 * is not flush. Do not inset the bottom safe area here — that would shrink
 * the ScrollView and leave a dead strip; iOS contentInsetAdjustmentBehavior
 * already pads scrolled content above the home indicator.
 */
export function SheetScaffold({
  children,
  footer,
  refreshing,
  onRefresh,
}: {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
}) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-10"
        contentContainerStyle={{ paddingTop: 12 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {children}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}
