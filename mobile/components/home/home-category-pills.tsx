import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  FolderIcon,
  InboxIcon,
  MessageSquareIcon,
  type LucideIcon,
} from "lucide-react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

export type HomeCategory = "chats" | "tasks" | "projects";

/**
 * Match Gmail inbox category chips: ~32pt circles, ~6pt gaps, selected
 * expands to the right so the icon barely moves.
 */
const CHIP_FILL = "#E8E8ED";
const CHIP_SIZE = 32;
const CHIP_GAP = 6;
const ICON_SIZE = 15;
const LABEL_SIZE = 13;
const SELECTED_PAD_X = 10;
const LABEL_GAP = 5;
/** Keeps the glyph optically centered in the collapsed circle. */
const COLLAPSED_PAD_X = (CHIP_SIZE - ICON_SIZE) / 2;
const ACCENT_FG = "#FFFFFF";

const CATEGORY_ACCENT: Record<HomeCategory, string> = {
  chats: "#3B82F6",
  tasks: "#F59E0B",
  projects: "#8B5CF6",
};

/** Precomputed expanded widths (pads + icon + gap + label) for stable morphing. */
const EXPANDED_WIDTH: Record<HomeCategory, number> = {
  chats: 78,
  tasks: 76,
  projects: 92,
};

const SPRING = { damping: 24, stiffness: 260, mass: 0.85 };

const CATEGORIES: readonly {
  readonly id: HomeCategory;
  readonly label: string;
  readonly Icon: LucideIcon;
}[] = [
  { id: "chats", label: "Chats", Icon: MessageSquareIcon },
  { id: "tasks", label: "Tasks", Icon: InboxIcon },
  { id: "projects", label: "Projects", Icon: FolderIcon },
];

/** Gmail-style category chips: selected pill morphs open with label. */
export function HomeCategoryPills({
  value,
  onChange,
}: {
  readonly value: HomeCategory;
  readonly onChange: (next: HomeCategory) => void;
}) {
  const foreground =
    (useCSSVariable("--color-foreground") as string | undefined) ?? "#111";

  return (
    <View
      style={{
        height: CHIP_SIZE,
        flexDirection: "row",
        alignItems: "center",
        gap: CHIP_GAP,
      }}
    >
      {CATEGORIES.map((category) => (
        <CategoryChip
          key={category.id}
          category={category}
          selected={category.id === value}
          foreground={foreground}
          onPress={() => {
            if (category.id === value) return;
            void Haptics.selectionAsync().catch(() => {});
            onChange(category.id);
          }}
        />
      ))}
    </View>
  );
}

function CategoryChip({
  category,
  selected,
  foreground,
  onPress,
}: {
  readonly category: (typeof CATEGORIES)[number];
  readonly selected: boolean;
  readonly foreground: string;
  readonly onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const accent = CATEGORY_ACCENT[category.id];
  const expanded = EXPANDED_WIDTH[category.id];

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, SPRING);
  }, [progress, selected]);

  const chipStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const clamp = Extrapolation.CLAMP;
    return {
      width: interpolate(p, [0, 1], [CHIP_SIZE, expanded], clamp),
      paddingLeft: interpolate(
        p,
        [0, 1],
        [COLLAPSED_PAD_X, SELECTED_PAD_X],
        clamp,
      ),
      paddingRight: interpolate(
        p,
        [0, 1],
        [COLLAPSED_PAD_X, SELECTED_PAD_X],
        clamp,
      ),
      backgroundColor: interpolateColor(p, [0, 1], [CHIP_FILL, accent]),
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const clamp = Extrapolation.CLAMP;
    return {
      opacity: interpolate(p, [0.45, 1], [0, 1], clamp),
      maxWidth: interpolate(p, [0, 1], [0, 72], clamp),
      marginLeft: interpolate(p, [0, 1], [0, LABEL_GAP], clamp),
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={category.label}
      onPress={onPress}
      hitSlop={6}
    >
      <Animated.View
        style={[
          {
            height: CHIP_SIZE,
            borderRadius: CHIP_SIZE / 2,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
          },
          chipStyle,
        ]}
      >
        <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
          <Icon
            as={category.Icon}
            size={ICON_SIZE}
            color={selected ? ACCENT_FG : foreground}
          />
        </View>
        <Animated.View style={[{ overflow: "hidden" }, labelStyle]}>
          <Text
            numberOfLines={1}
            style={{
              color: ACCENT_FG,
              fontSize: LABEL_SIZE,
              fontWeight: "600",
              letterSpacing: -0.2,
            }}
          >
            {category.label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
