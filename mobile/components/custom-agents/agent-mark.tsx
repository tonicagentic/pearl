import { View } from "react-native";

/** Colored mark with white “eyes” — agent identity for lists, pins, and pills. */
export function AgentMark({
  accent = "#2DD4BF",
  size = 16,
  shape = "circle",
}: {
  readonly accent?: string;
  readonly size?: number;
  /** Circles for list rows; squircles for the Grok-style pinned strip. */
  readonly shape?: "circle" | "squircle";
}) {
  const eyeHeight = Math.max(4, Math.round(size * 0.28));
  const eyeWidth = Math.max(2, Math.round(size * 0.1));
  const eyeGap = Math.max(2, Math.round(size * 0.08));
  const borderRadius =
    shape === "squircle" ? Math.round(size * 0.28) : size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: eyeGap }}>
        <View
          style={{
            width: eyeWidth,
            height: eyeHeight,
            borderRadius: eyeWidth,
            backgroundColor: "#FFFFFF",
          }}
        />
        <View
          style={{
            width: eyeWidth,
            height: eyeHeight,
            borderRadius: eyeWidth,
            backgroundColor: "#FFFFFF",
          }}
        />
      </View>
    </View>
  );
}

/**
 * List subtitle for an agent row: prefer chat title when it differs from the
 * name; otherwise first line of instructions; otherwise null.
 */
export function agentListSubtitle(input: {
  readonly name: string;
  readonly chatTitle?: string | null;
  readonly instructions?: string | null;
}): string | null {
  const name = input.name.trim();
  const title = (input.chatTitle ?? "").trim();
  if (title && title.toLowerCase() !== name.toLowerCase()) {
    return title;
  }
  const instructions = (input.instructions ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return instructions || null;
}
