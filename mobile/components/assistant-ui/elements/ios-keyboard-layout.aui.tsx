import {
  ComposerChromeContext,
  type ComposerChromeApi,
} from "@/components/assistant-ui/elements/composer-chrome";
import {
  COMPOSER_BLUR_COLLAPSE_MS,
  COMPOSER_MENU_HOLD_MS,
  COMPOSER_MORPH_RANGE,
  composerKeyboardProgress,
} from "@/components/assistant-ui/elements/composer-morph";
import {
  KeyboardController,
  useKeyboardHandler,
} from "@/src/keyboard-controller";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
} from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export const KeyboardHeightContext = createContext<SharedValue<number> | null>(
  null,
);
/** Full keyboard height, latched when a show starts, so a drag morphs across the whole travel. */
export const KeyboardSpanContext = createContext<SharedValue<number> | null>(
  null,
);

/** One UI-thread keyboard height drives the iOS composer and transcript together. */
export const IosKeyboardLayout: FC<{
  children: ReactNode;
  /** New-chat mounts start at 0 so a leftover home keyboard cannot mid-morph. */
  seedAtZero?: boolean;
}> = ({ children, seedAtZero = false }) => {
  // Existing chats may mount while the keyboard is already open (e.g. after
  // sign-in). New chats always seed at 0 so the composer stays minimized until
  // post-transition focus raises the keyboard once.
  const keyboardHeight = useSharedValue(
    seedAtZero
      ? 0
      : KeyboardController.isVisible()
        ? KeyboardController.state().height
        : 0,
  );
  const keyboardSpan = useSharedValue(
    seedAtZero
      ? COMPOSER_MORPH_RANGE
      : KeyboardController.isVisible()
        ? Math.max(COMPOSER_MORPH_RANGE, KeyboardController.state().height)
        : COMPOSER_MORPH_RANGE,
  );
  // Sticky is only for native menus stealing focus — keyboard height alone
  // drives the morph while the field is selected.
  const stickyExpanded = useSharedValue(0);
  const textExpanded = useSharedValue(0);
  const liveActive = useSharedValue(0);
  const keyboardDragging = useSharedValue(0);
  const widthProgress = useSharedValue(
    seedAtZero || !KeyboardController.isVisible() ? 0 : 1,
  );
  const widthAnimating = useSharedValue(0);
  const stickyClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuHoldUntil = useRef(0);

  const setLiveActive = useCallback(
    (active: boolean) => {
      liveActive.value = active ? 1 : 0;
    },
    [liveActive],
  );

  const collapseNow = useCallback(() => {
    if (stickyClearTimer.current) {
      clearTimeout(stickyClearTimer.current);
      stickyClearTimer.current = null;
    }
    menuHoldUntil.current = 0;
    stickyExpanded.value = 0;
  }, [stickyExpanded]);

  const pinExpanded = useCallback(() => {
    if (stickyClearTimer.current) {
      clearTimeout(stickyClearTimer.current);
      stickyClearTimer.current = null;
    }
    stickyExpanded.value = 1;
    // SwiftUI menus never signal close; always release sticky after a hold.
    menuHoldUntil.current = Date.now() + COMPOSER_MENU_HOLD_MS;
    stickyClearTimer.current = setTimeout(() => {
      stickyClearTimer.current = null;
      menuHoldUntil.current = 0;
      stickyExpanded.value = 0;
    }, COMPOSER_MENU_HOLD_MS);
  }, [stickyExpanded]);

  const scheduleCollapse = useCallback(() => {
    if (stickyClearTimer.current) clearTimeout(stickyClearTimer.current);
    // Blur often races a menu pin; honor the remaining menu hold so chrome
    // does not jump under the sheet, then always clear (keyboard progress
    // alone keeps the morph if the keyboard is still up).
    const delay = Math.max(
      COMPOSER_BLUR_COLLAPSE_MS,
      menuHoldUntil.current - Date.now(),
    );
    stickyClearTimer.current = setTimeout(() => {
      stickyClearTimer.current = null;
      menuHoldUntil.current = 0;
      stickyExpanded.value = 0;
    }, delay);
  }, [stickyExpanded]);

  useEffect(
    () => () => {
      if (stickyClearTimer.current) clearTimeout(stickyClearTimer.current);
    },
    [],
  );

  const chromeApi = useMemo<ComposerChromeApi>(
    () => ({
      textExpanded,
      stickyExpanded,
      liveActive,
      keyboardDragging,
      widthProgress,
      pinExpanded,
      scheduleCollapse,
      collapseNow,
      setLiveActive,
    }),
    [
      textExpanded,
      stickyExpanded,
      liveActive,
      keyboardDragging,
      widthProgress,
      pinExpanded,
      scheduleCollapse,
      collapseNow,
      setLiveActive,
    ],
  );

  useKeyboardHandler(
    {
      onStart: (event) => {
        "worklet";
        // Destination height only. Writing it onto keyboardHeight snaps the
        // text field open, then the in-flight frames shrink it again.
        const destination = Math.max(0, event.height);
        if (destination > COMPOSER_MORPH_RANGE) {
          keyboardSpan.value = destination;
        }
        // Keyboard move events arrive in large steps. Play the width across
        // the whole transition instead of copying those steps.
        if (event.duration > 0) {
          widthAnimating.value = 1;
          widthProgress.value = withTiming(
            destination > 0 ? 1 : 0,
            { duration: event.duration, easing: Easing.linear },
            (finished) => {
              "worklet";
              if (finished) widthAnimating.value = 0;
            },
          );
        }
      },
      onMove: (event) => {
        "worklet";
        const next = Math.max(0, event.height);
        // Hide the caret while the keyboard travels down. Showing it still
        // animates upward, so a rising keyboard keeps the cursor.
        if (next + 1 < keyboardHeight.value) keyboardDragging.value = 1;
        keyboardHeight.value = next;
        if (widthAnimating.value === 0) {
          widthProgress.value = composerKeyboardProgress(
            next,
            keyboardSpan.value,
          );
        }
      },
      onInteractive: (event) => {
        "worklet";
        const next = Math.max(0, event.height);
        if (next + 1 < keyboardHeight.value) keyboardDragging.value = 1;
        keyboardHeight.value = next;
        widthAnimating.value = 0;
        widthProgress.value = composerKeyboardProgress(
          next,
          keyboardSpan.value,
        );
        // Finger-drag dismiss collapses immediately and drops any menu hold.
        if (event.height < 40) runOnJS(collapseNow)();
      },
      onEnd: (event) => {
        "worklet";
        const next = Math.max(0, event.height);
        keyboardHeight.value = next;
        keyboardDragging.value = 0;
        widthProgress.value = composerKeyboardProgress(
          next,
          keyboardSpan.value,
        );
        // Do not latch sticky from keyboard motion — that left chrome stuck
        // expanded after dismiss. Menus pin explicitly via pinExpanded.
      },
    },
    [
      collapseNow,
      keyboardDragging,
      keyboardSpan,
      widthAnimating,
      widthProgress,
    ],
  );
  const spacerStyle = useAnimatedStyle(() => ({
    // Tracks interactive drag; composer dock morphs against the same value.
    height: Math.max(0, keyboardHeight.value),
  }));

  return (
    <KeyboardHeightContext.Provider value={keyboardHeight}>
      <KeyboardSpanContext.Provider value={keyboardSpan}>
        <ComposerChromeContext.Provider value={chromeApi}>
          <View className="flex-1">
            {children}
            <Animated.View pointerEvents="none" style={spacerStyle} />
          </View>
        </ComposerChromeContext.Provider>
      </KeyboardSpanContext.Provider>
    </KeyboardHeightContext.Provider>
  );
};
