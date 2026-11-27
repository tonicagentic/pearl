import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { ProjectLabelColor, ProjectLabelDto } from "@/src/projects-client";

const LABEL_DOT: Record<ProjectLabelColor, string> = {
  gray: "bg-muted-foreground",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

/** Compact colored chip for a project label. */
export function ProjectLabelChip({
  label,
}: {
  readonly label: ProjectLabelDto;
}) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full border border-border/40 bg-muted/50 px-2 py-0.5">
      <View
        className={`size-2 rounded-full ${LABEL_DOT[label.color] ?? LABEL_DOT.gray}`}
      />
      <Text variant="caption" numberOfLines={1}>
        {label.name}
      </Text>
    </View>
  );
}

export const PROJECT_LABEL_COLOR_OPTIONS: readonly {
  readonly value: ProjectLabelColor;
  readonly label: string;
}[] = [
  { value: "gray", label: "Gray" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
];
