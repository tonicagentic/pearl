import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { PearlIntroPager } from "@/components/pearl-intro-pager";

/** Signed-out start: full-screen swipeable Pearl intro into sign-in or self-host. */
export function PearlIntroScreen({
  onContinueWithHost,
  onSelfHost,
}: {
  readonly onContinueWithHost: () => void;
  readonly onSelfHost: () => void;
}) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <PearlIntroPager
        onContinueWithHost={onContinueWithHost}
        onSelfHost={onSelfHost}
      />
    </SafeAreaView>
  );
}
