import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";
import { KeyboardController } from "react-native-keyboard-controller";

export type ComposerChromeApi = {
  readonly stickyExpanded: SharedValue<number>;
  /** 1 while a live call fills the composer — keeps dock inset expanded with no keyboard. */
  readonly liveActive: SharedValue<number>;
  /** Hold full chrome (focus or chrome-control tap before a native menu opens). */
  readonly pinExpanded: () => void;
  /** Collapse shortly after blur once the keyboard is gone (menus get a beat to open). */
  readonly scheduleCollapse: () => void;
  /** Collapse immediately (interactive dismiss, Live, etc.). */
  readonly collapseNow: () => void;
  readonly setLiveActive: (active: boolean) => void;
};

/**
 * Sticky full-chrome API. Native attachment/model menus resign the field and
 * drop the keyboard; pin + delayed collapse keeps the morph from jumping mid-tap
 * without leaving the composer stuck expanded after dismiss.
 */
export const ComposerChromeContext = createContext<ComposerChromeApi | null>(
  null,
);

export function useComposerChrome(): ComposerChromeApi | null {
  return useContext(ComposerChromeContext);
}

/**
 * Pin full chrome when a native menu/sheet is about to steal focus, but only
 * while the keyboard is already up — pinning while collapsed would expand the
 * morph under the sheet.
 */
export function pinComposerIfKeyboardVisible(
  chrome: ComposerChromeApi | null | undefined,
) {
  if (KeyboardController.isVisible()) chrome?.pinExpanded();
}
