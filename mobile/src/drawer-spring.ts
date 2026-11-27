import { ReduceMotion } from "react-native-reanimated";

/**
 * Same spring react-native-drawer-layout uses for open/close settle.
 * Stiff + heavy + overshootClamping → snaps without bounce.
 */
export const DRAWER_SPRING = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
  reduceMotion: ReduceMotion.Never,
} as const;

/** Same curve shape as {@link DRAWER_SPRING}, lower mass for small UI (popovers). */
export const DRAWER_SPRING_FAST = {
  ...DRAWER_SPRING,
  mass: 0.7,
} as const;
