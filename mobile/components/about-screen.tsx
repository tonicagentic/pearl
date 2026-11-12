import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { PearlIntroPager } from "@/components/pearl-intro-pager";

/**
 * Settings → About Pearl. Hosts the swipeable intro; last panel offers
 * hosted continue (pop) or Self-host (push connect screen).
 */
export function AboutScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }]}
      edges={["top", "left", "right", "bottom"]}
    >
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
});
