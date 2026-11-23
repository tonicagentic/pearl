import { Easing, Extrapolation, interpolate } from "react-native-reanimated";

export const COMPOSER_SHELL_RADIUS = 26;
/** Side/bottom float for the iOS composer dock (Mail-style inset from the screen edge). */
export const COMPOSER_EDGE = 16;
/** Extra side inset while collapsed so the mini-player bar doesn’t span edge-to-edge. */
export const COMPOSER_MINIMIZED_EDGE = 28;
/** Idle (keyboard closed) tuck: sit nearer the home indicator than the expanded float. */
export const COMPOSER_MINIMIZED_BOTTOM_GAP = 4;
/** Keyboard height range that morphs minimized ↔ expanded chrome (follows interactive drag). */
export const COMPOSER_MORPH_RANGE = 120;
export const COMPOSER_CHIP = 32;
export const COMPOSER_ROW_GAP = 6;
/** Collapsed field/row height — match the + / Live chips for vertical centering. */
export const COMPOSER_MIN_INPUT = COMPOSER_CHIP;
/** 17px / 22 leading centered in COMPOSER_MIN_INPUT. */
export const COMPOSER_COLLAPSED_INPUT_PAD_Y = (COMPOSER_MIN_INPUT - 22) / 2;
/** One line + compact pad — keep tight to the action row when empty. */
export const COMPOSER_EXPANDED_INPUT_MIN = 34;
export const COMPOSER_EXPANDED_INPUT_MAX = 192;
/** Line-count changes ease instead of snapping the shell. */
export const COMPOSER_SIZE_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
} as const;
export const COMPOSER_SHELL_STYLE = {
  borderRadius: COMPOSER_SHELL_RADIUS,
  borderCurve: "continuous",
  // Clip GlassView to one continuous corner — without this the glass surface
  // and shell radius anti-alias as a double edge at the pill corners.
  overflow: "hidden",
} as const;
/**
 * Same lift as the system liquid-glass controls (nav back button).
 * Drawn on the shell so the corner clip does not cut it off.
 */
export const LIQUID_GLASS_SHADOW_LIGHT = {
  boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
} as const;
export const LIQUID_GLASS_SHADOW_DARK = {
  boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.22)",
} as const;
export const GLASS_SURFACE_STYLE = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  ...COMPOSER_SHELL_STYLE,
} as const;
export const COMPOSER_HOLD_SPRING = { damping: 22, stiffness: 420 } as const;

/** Hold full chrome through a native menu; menus do not report dismiss. */
export const COMPOSER_MENU_HOLD_MS = 2500;
/** After blur, collapse sticky once menus have had a beat to open. */
export const COMPOSER_BLUR_COLLAPSE_MS = 450;

/** 0 = minimized, 1 = expanded. Tracks the finger across the whole keyboard travel. */
export function composerKeyboardProgress(
  keyboardHeight: number,
  span: number,
): number {
  "worklet";
  const range = Math.max(span, COMPOSER_MORPH_RANGE);
  return interpolate(keyboardHeight, [0, range], [0, 1], Extrapolation.CLAMP);
}

/** Expanded press grow. Fades out through halfway so the width does not pop. */
export function composerPressBump(
  progress: number,
  pressed: number,
  enabled: boolean,
): number {
  "worklet";
  if (!enabled) return 1;
  const amount = interpolate(
    progress,
    [0.5, 1],
    [0, Math.min(pressed, 1)],
    Extrapolation.CLAMP,
  );
  return 1 + amount * 0.02;
}

/** Pressed shell shrink. Fades in below halfway so it does not pop the width. */
export function composerHoldScale(
  progress: number,
  pressed: number,
  enabled: boolean,
): number {
  "worklet";
  if (!enabled) return 1;
  const pressAmount = interpolate(
    progress,
    [0.5, 0],
    [0, Math.min(pressed, 1)],
    Extrapolation.CLAMP,
  );
  return 1 - pressAmount * 0.025;
}

/** Side inset. Separate from keyboard progress so the shrink can ease out. */
export function composerWidthProgress(
  widthProgress: number,
  stickyExpanded: number,
  textExpanded: number,
): number {
  "worklet";
  return Math.max(widthProgress, stickyExpanded, textExpanded);
}

/** Chrome morph: keyboard progress, held open while sticky after menus steal focus. */
export function composerChromeProgress(
  keyboardHeight: number,
  stickyExpanded: number,
  span: number,
  textExpanded = 0,
): number {
  "worklet";
  return Math.max(
    composerKeyboardProgress(keyboardHeight, span),
    stickyExpanded,
    textExpanded,
  );
}

/**
 * Input width at the two rest poses. Measured shell width lags the padding
 * animation and makes the shrink step; height never reads that measurement.
 */
export function composerInputWidth(
  windowWidth: number,
  progress: number,
): {
  left: number;
  width: number;
} {
  "worklet";
  const shellPad = 16;
  const expanded = Math.max(0, windowWidth - COMPOSER_EDGE * 2 - shellPad);
  const collapsed = Math.max(
    0,
    windowWidth - COMPOSER_MINIMIZED_EDGE * 2 - shellPad,
  );
  const mini = Math.max(
    0,
    collapsed - COMPOSER_CHIP * 2 - COMPOSER_ROW_GAP * 2,
  );
  return {
    left: interpolate(progress, [0, 1], [COMPOSER_CHIP + COMPOSER_ROW_GAP, 0]),
    width: interpolate(progress, [0, 1], [mini, expanded]),
  };
}

/** Placeholder is fully gone while the field crosses the model button. */
export function composerPlaceholderOpacity(progress: number): number {
  "worklet";
  if (progress < 0.5) {
    return interpolate(progress, [0, 0.1], [1, 0], Extrapolation.CLAMP);
  }
  return interpolate(progress, [0.92, 1], [0, 1], Extrapolation.CLAMP);
}
