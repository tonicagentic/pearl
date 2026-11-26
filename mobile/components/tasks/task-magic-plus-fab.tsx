import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { PlusIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

const EDGE = 16;
const FAB_SIZE = 56;

/** List padding so rows clear the Magic Plus FAB. */
export const TASK_MAGIC_PLUS_CLEARANCE = FAB_SIZE + 28;

/** Bottom-right + control for Tasks home / smart lists. */
export function TaskMagicPlusFab({
  onPress,
  accessibilityLabel = "New task",
  hidden = false,
}: {
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  /** Hide while the quick-add sheet is open so it cannot steal touches. */
  readonly hidden?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const restingPad = Math.max(insets.bottom, 12) + 4;

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          onPress();
        }}
        style={[styles.fab, { bottom: restingPad, right: EDGE }]}
      >
        <View
          style={[
            styles.shell,
            {
              borderRadius: FAB_SIZE / 2,
              backgroundColor: primaryColor ?? "#111111",
            },
          ]}
        >
          <Icon
            as={PlusIcon}
            size={26}
            color={primaryForeground ?? "#FFFFFF"}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  fab: {
    position: "absolute",
  },
  shell: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
