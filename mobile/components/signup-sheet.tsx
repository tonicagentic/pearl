import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { XIcon } from "lucide-react-native";

import { SignInScreen } from "@/components/sign-in-screen";
import { Icon } from "@/components/ui/icon";

/**
 * Modal hosting the continue-method auth gate so a guest can upgrade in place.
 * Skips the Pearl intro carousel — that only runs on cold signed-out entry.
 */
export function SignupSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
          >
            <Icon as={XIcon} size={22} color={foregroundColor ?? "#111"} />
          </Pressable>
        </View>
        <SignInScreen skipIntro />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  close: {
    alignSelf: "flex-start",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
