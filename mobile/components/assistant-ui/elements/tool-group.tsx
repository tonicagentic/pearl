import { useState, type ReactNode } from "react";
import { ChevronDownIcon, Loader } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/utils";

// RN port of the web tool-group element: a collapsible "N tool calls" lane.
// The web animates through a Collapsible primitive; RN toggles the content
// directly, matching the rest of the mobile kit's interaction depth.

export function ToolGroup({
  count,
  active = false,
  children,
}: {
  readonly count: number;
  /** True while the turn is running: the trigger shows the loader + shimmer. */
  readonly active?: boolean;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = `${count} tool ${count === 1 ? "call" : "calls"}`;

  return (
    <View className="w-full rounded-lg border py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-2 px-4 py-1.5"
        onPress={() => setOpen((value) => !value)}
      >
        {active ? (
          <Loader className="size-3 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        <Text
          numberOfLines={1}
          className={cn(
            "flex-1 text-start text-xs font-medium leading-none text-muted-foreground",
            active && "animate-pulse",
          )}
        >
          {label}
        </Text>
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </Pressable>
      {open ? (
        <View className="mt-3 flex-col gap-2 border-t border-border/60 px-4 pt-3">
          {children}
        </View>
      ) : null}
    </View>
  );
}
