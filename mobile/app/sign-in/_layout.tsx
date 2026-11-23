import { Stack } from "expo-router";

import {
  usePearlScreenBackground,
  usePearlStackScreenOptions,
} from "@/src/navigation-theme";

/**
 * Auth gate stack — index is the intro/methods screen; email pushes with the
 * platform’s default native slide. Email opts into a transparent header so the
 * liquid-glass Toolbar back can paint correctly.
 */
export default function SignInLayout() {
  const backgroundColor = usePearlScreenBackground();
  const screenOptions = usePearlStackScreenOptions();

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        contentStyle: { backgroundColor },
        animation: "slide_from_right",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="email" />
    </Stack>
  );
}
