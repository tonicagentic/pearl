import { View } from "react-native";
import {
  BoxIcon,
  FolderIcon,
  HexagonIcon,
  LayersIcon,
  PackageIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react-native";

const MARKS: readonly {
  readonly icon: LucideIcon;
  readonly color: string;
}[] = [
  { icon: BoxIcon, color: "#f97316" },
  { icon: PackageIcon, color: "#a855f7" },
  { icon: LayersIcon, color: "#06b6d4" },
  { icon: HexagonIcon, color: "#eab308" },
  { icon: FolderIcon, color: "#3b82f6" },
  { icon: SparklesIcon, color: "#ec4899" },
  { icon: BoxIcon, color: "#14b8a6" },
  { icon: PackageIcon, color: "#ef4444" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function projectMarkFor(name: string): {
  readonly icon: LucideIcon;
  readonly color: string;
} {
  return MARKS[hashName(name.trim() || "project") % MARKS.length]!;
}

/** Colored Lucide mark derived from the project name. Client-only; nothing is saved. */
export function ProjectMark({
  name,
  size = "md",
}: {
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
}) {
  const mark = projectMarkFor(name);
  const Glyph = mark.icon;
  const box =
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "lg" ? 20 : size === "sm" ? 14 : 16;

  return (
    <View
      className={`${box} items-center justify-center rounded-lg`}
      style={{ backgroundColor: `${mark.color}22` }}
    >
      <Glyph color={mark.color} size={iconSize} strokeWidth={2} />
    </View>
  );
}
