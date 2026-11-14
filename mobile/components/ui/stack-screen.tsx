import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

/**
 * Body for stack screens with a native header title.
 * Edges left/right only — top inset comes from the stack header.
 * Prefer SheetScaffold for settings-style scrolling lists.
 */
export function StackScreen({ children }: { readonly children: ReactNode }) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >
      {children}
    </SafeAreaView>
  );
}
