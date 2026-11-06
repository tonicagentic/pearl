import { useState, type ReactNode } from "react";
import { ChevronDownIcon, Loader, WrenchIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getToolPresentation } from "./tool-presentation";
import { threadMeta } from "./surfaces";

// RN port of the web tool-group element: a collapsible "N tool calls" lane.
// The web animates through a Collapsible primitive; RN toggles the content
// directly, matching the rest of the mobile kit's interaction depth.

export function ToolGroup({
  count,
  toolName,
  active = false,
  defaultOpen = false,
  statusHint,
  children,
}: {
  readonly count: number;
  /** When the group is a single tool, show its human label + icon. */
  readonly toolName?: string;
  /** True while the turn is running: the trigger shows the loader + shimmer. */
  readonly active?: boolean;
  /** HITL parks start expanded so Allow/Deny is visible without an extra tap. */
  readonly defaultOpen?: boolean;
  /** Compact outcome for the collapsed header, e.g. "Approved" or "Waiting". */
  readonly statusHint?: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const solo =
    count === 1 && toolName ? getToolPresentation(toolName) : undefined;
  const label = solo
    ? solo.label
    : `${count} tool ${count === 1 ? "call" : "calls"}`;

  return (
    <View className="border-border/60 bg-card w-full rounded-2xl border py-1 shadow-sm shadow-black/5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-10 flex-row items-center gap-2 px-3.5 py-2 active:opacity-80"
        onPress={() => setOpen((value) => !value)}
      >
        {active ? (
          <Loader className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Icon
            as={solo?.icon ?? WrenchIcon}
            className="size-3.5 shrink-0 text-muted-foreground/70"
          />
        )}
        <Text
          numberOfLines={1}
          className={cn(
            threadMeta,
            "flex-1 text-start leading-6",
            active && "animate-pulse",
          )}
        >
          {label}
          {statusHint ? (
            <Text className="text-muted-foreground/80 font-normal">
              {" · "}
              {statusHint}
            </Text>
          ) : null}
        </Text>
        <View
          className="size-3.5 items-center justify-center"
          style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }}
        >
          <Icon
            as={ChevronDownIcon}
            className="size-3.5 text-muted-foreground/55"
          />
        </View>
      </Pressable>
      {open ? (
        <View className="mt-1 flex-col gap-2 border-t border-border/50 px-3.5 pt-3 pb-2.5">
          {children}
        </View>
      ) : null}
    </View>
  );
}
