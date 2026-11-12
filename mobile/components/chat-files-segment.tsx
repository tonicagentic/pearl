import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/utils";

export type MainTab = "chat" | "files";

const OPTIONS: readonly { readonly id: MainTab; readonly label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "files", label: "Files" },
];

/**
 * Center Chat | Files control for the chat header (iOS floating + Android stack).
 */
export function ChatFilesSegment({
  value,
  onChange,
  disabled = false,
  filesBadge = false,
}: {
  readonly value: MainTab;
  readonly onChange: (tab: MainTab) => void;
  readonly disabled?: boolean;
  /** Soft cue that workspace tabs exist while Chat is selected. */
  readonly filesBadge?: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row overflow-hidden rounded-full border border-border/60 bg-card/90 p-0.5",
        disabled && "opacity-40",
      )}
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityRole="tablist"
    >
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={
              option.id === "files" && filesBadge && !active
                ? "Files, open tabs available"
                : option.label
            }
            className={cn(
              "min-h-8 min-w-[4.5rem] items-center justify-center rounded-full px-3.5 py-1.5",
              active && "bg-foreground/10",
            )}
            onPress={() => {
              if (!disabled && value !== option.id) onChange(option.id);
            }}
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.label}
              </Text>
              {option.id === "files" && filesBadge && !active ? (
                <View className="bg-primary size-1.5 rounded-full" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
