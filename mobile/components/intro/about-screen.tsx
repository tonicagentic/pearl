import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { PearlIntroPager } from "@/components/intro/pearl-intro-pager";
import { isHostedLocked } from "@/src/eve-transport";

/**
 * Settings → About Pearl. Hosts the swipeable intro; last panel offers
 * hosted continue (pop) or Self-host (push connect screen) when unlocked.
 */
export function AboutScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const locked = isHostedLocked();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <PearlIntroPager
        compact
        continueLabel="Done"
        onContinueWithHost={() => router.back()}
        onSelfHost={
          locked ? undefined : () => router.push("/settings/self-host")
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
