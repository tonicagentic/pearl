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
 * Holds the native-splash look, fades Pearl out, then clears the splash field.
 *
 * Critical: the app tree stays at opacity 1 the whole time. Fading an ancestor
 * of `GlassView` / system liquid-glass chrome through ~0 permanently skips the
 * UIKit glass effect (Apple + expo-glass-effect guidance) — that left composer
 * and toolbar glass blank after boot, with only native menus flashing glass.
 */
export function BootReveal({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const splashBg = SPLASH_BG[scheme];
  const logoOpacity = useSharedValue(1);
  const splashOpacity = useSharedValue(1);
  const [splashGone, setSplashGone] = useState(false);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const splashStyle = useAnimatedStyle(() => ({ opacity: splashOpacity.value }));

  useEffect(() => {
    // 1) Pearl fades out on the splash field.
    logoOpacity.value = withTiming(
      0,
      { duration: LOGO_OUT_MS, easing: EASE },
      (logoDone) => {
        if (!logoDone) return;
        // 2) Splash clears — app underneath was always opaque.
        splashOpacity.value = withTiming(
          0,
          { duration: APP_IN_MS, easing: EASE },
          (done) => {
            if (done) runOnJS(setSplashGone)(true);
          },
        );
      },
    );
  }, [logoOpacity, splashOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: splashBg }]}>
      <View style={styles.fill}>{children}</View>
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
