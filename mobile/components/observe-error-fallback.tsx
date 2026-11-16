import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

type ObserveErrorFallbackProps = {
  readonly resetError: () => void;
};

/** Full-screen fallback when Expo Observe catches a render error at the root. */
export function ObserveErrorFallback({ resetError }: ObserveErrorFallbackProps) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="display" className="text-center tracking-tight">
          Something went wrong
        </Text>
        <Text variant="body" tone="muted" className="mb-2 text-center leading-[22px]">
          Pearl hit an unexpected error. You can try again without losing your
          account.
        </Text>
        <Button label="Try again" onPress={resetError} />
      </View>
    </SafeAreaView>
  );
}
