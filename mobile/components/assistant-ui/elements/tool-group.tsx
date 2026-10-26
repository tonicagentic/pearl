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
  defaultOpen = false,
  statusHint,
  children,
}: {
  readonly count: number;
  /** True while the turn is running: the trigger shows the loader + shimmer. */
  readonly active?: boolean;
  /** HITL parks start expanded so Allow/Deny is visible without an extra tap. */
  readonly defaultOpen?: boolean;
  /** Compact outcome for the collapsed header, e.g. "Approved" or "Waiting". */
  readonly statusHint?: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = `${count} tool ${count === 1 ? "call" : "calls"}`;

  return (
    <View className="border-border/60 bg-card w-full rounded-2xl border py-2.5 shadow-sm shadow-black/5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-2 px-3.5 py-1.5 active:opacity-80"
        onPress={() => setOpen((value) => !value)}
      >
        {active ? (
          <Loader className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        <Text
          numberOfLines={1}
          className={cn(
            "text-foreground/70 flex-1 text-start text-sm font-medium leading-none",
            active && "animate-pulse",
          )}
        >
          {label}
          {statusHint ? (
            <Text className="text-muted-foreground font-normal">
              {" · "}
              {statusHint}
            </Text>
          ) : null}
        </Text>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </Pressable>
      {open ? (
        <View className="mt-2 flex-col gap-2 border-t border-border/50 px-3.5 pt-3">
          {children}
        </View>
      ) : null}
    </View>
  );
}
