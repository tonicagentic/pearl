import { Pressable, Text, View } from "react-native";
import {
  FolderIcon,
  InboxIcon,
  MessageSquareIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

export type HomeCategory = "chats" | "tasks" | "projects";

/** Visible chip fill — avoid `--color-muted`, which often matches the page. */
const CHIP_FILL = "#E8E8ED";
const CHIP_SIZE = 36;

const CATEGORIES: readonly {
  readonly id: HomeCategory;
  readonly label: string;
  readonly Icon: LucideIcon;
}[] = [
  { id: "chats", label: "Chats", Icon: MessageSquareIcon },
  { id: "tasks", label: "Tasks", Icon: InboxIcon },
  { id: "projects", label: "Projects", Icon: FolderIcon },
];

/** Gmail-style category chips: selected pill with label, others icon-only. */
export function HomeCategoryPills({
  value,
  onChange,
}: {
  readonly value: HomeCategory;
  readonly onChange: (next: HomeCategory) => void;
}) {
  const primary =
    (useCSSVariable("--color-primary") as string | undefined) ?? "#111111";
  const primaryForeground =
    (useCSSVariable("--color-primary-foreground") as string | undefined) ??
    "#FFFFFF";
  const foreground =
    (useCSSVariable("--color-foreground") as string | undefined) ?? "#111";

  return (
    <View
      style={{
        minHeight: CHIP_SIZE,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {CATEGORIES.map((category) => {
        const selected = category.id === value;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={category.label}
            onPress={() => onChange(category.id)}
            style={{
              height: CHIP_SIZE,
              borderRadius: 999,
              paddingHorizontal: selected ? 12 : 0,
              width: selected ? undefined : CHIP_SIZE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: selected ? primary : CHIP_FILL,
            }}
          >
            <Icon
              as={category.Icon}
              size={16}
              color={selected ? primaryForeground : foreground}
            />
            {selected ? (
              <Text
                style={{
                  color: primaryForeground,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {category.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
