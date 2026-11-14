import { ActivityIndicator, View } from "react-native";

/** Centered spinner for stack detail screens while data loads. */
export function LoadingCenter() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}
