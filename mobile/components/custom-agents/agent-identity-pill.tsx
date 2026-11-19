import { Pressable, Text, View } from "react-native";

/** Mobile Grok-style attachment pill for Pearl / custom-agent threads. */
export function AgentIdentityPill({
  name,
  accent = "#2DD4BF",
  onPress,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly onPress?: () => void;
}) {
  const label = name.trim() || "Agent";
  const body = (
    <>
      <View
        className="size-4 items-center justify-center rounded-full"
        style={{ backgroundColor: accent }}
      >
        <View className="flex-row items-center gap-0.5">
          <View className="h-1.5 w-0.5 rounded-full bg-white" />
          <View className="h-1.5 w-0.5 rounded-full bg-white" />
        </View>
      </View>
      <Text
        numberOfLines={1}
        className="shrink text-xs font-medium text-foreground"
      >
        {label}
      </Text>
    </>
  );
  const chrome =
    "h-7 max-w-[11rem] flex-row items-center gap-1.5 rounded-full border border-border bg-muted/50 px-1.5 pr-2.5";
  if (!onPress) {
    return <View className={chrome}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} actions`}
      hitSlop={6}
      onPress={onPress}
      className={`${chrome} active:opacity-80`}
    >
      {body}
    </Pressable>
  );
}
