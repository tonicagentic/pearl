import { useEffect, useState, type ReactNode } from "react";
import { Image, StyleSheet, useColorScheme, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const LIGHT_ICON = require("../assets/splash-icon.png");
const DARK_ICON = require("../assets/splash-icon-dark.png");

/** Matches `expo-splash-screen` `imageWidth` in app.json. */
const SPLASH_IMAGE_WIDTH = 200;

const SPLASH_BG = {
  light: "#F7F7F8",
  dark: "#141414",
} as const;

const LOGO_OUT_MS = 550;
const APP_IN_MS = 520;
const EASE = Easing.out(Easing.cubic);

/**
 * Holds the native-splash look, fades Pearl out, then fades the app in —
 * sequential so the handoff reads as one beat after another.
 */
export function BootReveal({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const splashBg = SPLASH_BG[scheme];
  const logoOpacity = useSharedValue(1);
  const splashOpacity = useSharedValue(1);
  const appOpacity = useSharedValue(0);
  const [splashGone, setSplashGone] = useState(false);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const splashStyle = useAnimatedStyle(() => ({ opacity: splashOpacity.value }));
  const appStyle = useAnimatedStyle(() => ({ opacity: appOpacity.value }));

  useEffect(() => {
    // 1) Pearl fades out on the splash field.
    logoOpacity.value = withTiming(
      0,
      { duration: LOGO_OUT_MS, easing: EASE },
      (logoDone) => {
        if (!logoDone) return;
        // 2) Then the splash field clears and the app fades in together.
        splashOpacity.value = withTiming(0, {
          duration: APP_IN_MS,
          easing: EASE,
        });
        appOpacity.value = withTiming(
          1,
          { duration: APP_IN_MS, easing: EASE },
          (appDone) => {
            if (appDone) runOnJS(setSplashGone)(true);
          },
        );
      },
    );
  }, [appOpacity, logoOpacity, splashOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: splashBg }]}>
      <Animated.View style={[styles.fill, appStyle]}>{children}</Animated.View>
      {splashGone ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: splashBg },
            splashStyle,
          ]}
        >
          <Animated.View style={logoStyle}>
            <Image
              accessibilityIgnoresInvertColors
              source={scheme === "dark" ? DARK_ICON : LIGHT_ICON}
              style={styles.mark}
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  mark: {
    width: SPLASH_IMAGE_WIDTH,
    height: SPLASH_IMAGE_WIDTH,
  },
});
