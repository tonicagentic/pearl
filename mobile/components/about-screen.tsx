import { Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { PearlIntroPager } from "@/components/pearl-intro-pager";

/**
 * Settings → About Pearl form sheet. Hosts the swipeable intro; last panel
 * offers hosted continue (dismiss) or Self-host (push connect screen).
 */
export function AboutScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }]}
      edges={["left", "right", "bottom"]}
    >
      <View
        style={[
          styles.titleWrap,
          { paddingTop: Platform.OS === "ios" ? 12 : 16 },
        ]}
      >
        <Text className="text-[17px] font-semibold text-foreground">About</Text>
      </View>
      <PearlIntroPager
        compact
        onContinueWithHost={() => router.back()}
        onSelfHost={() => router.push("/self-host")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleWrap: {
    alignItems: "center",
    paddingBottom: 4,
  },
});
