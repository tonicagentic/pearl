import {
  ComposerAddAttachment,
  ComposerAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { useComposerChrome } from "@/components/assistant-ui/elements/composer-chrome";
import {
  COMPOSER_COLLAPSED_INPUT_PAD_Y,
  COMPOSER_EDGE,
  COMPOSER_EXPANDED_INPUT_MAX,
  COMPOSER_EXPANDED_INPUT_MIN,
  COMPOSER_HOLD_SPRING,
  COMPOSER_MIN_INPUT,
  COMPOSER_MINIMIZED_BOTTOM_GAP,
  COMPOSER_MINIMIZED_EDGE,
  COMPOSER_MORPH_RANGE,
  COMPOSER_SHELL_RADIUS,
  COMPOSER_SHELL_STYLE,
  COMPOSER_SIZE_TIMING,
  GLASS_SURFACE_STYLE,
  LIQUID_GLASS_SHADOW_DARK,
  LIQUID_GLASS_SHADOW_LIGHT,
  composerChromeProgress,
  composerHoldScale,
  composerInputWidth,
  composerKeyboardProgress,
  composerPlaceholderOpacity,
  composerPressBump,
  composerWidthProgress,
} from "@/components/assistant-ui/elements/composer-morph";
import {
  composerControlHitSlop,
  iconButtonHitSlop,
} from "@/components/assistant-ui/elements/icon-button";
import {
  KeyboardHeightContext,
  KeyboardSpanContext,
} from "@/components/assistant-ui/elements/ios-keyboard-layout.aui";
import {
  useHydrated,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";
import { ThreadComponentsContext } from "@/components/assistant-ui/elements/thread-components-context";
import {
  WaitingActionCard,
  type WaitingAction,
} from "@/components/assistant-ui/elements/waiting-action-card";
import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { LiveSession } from "@/components/live-session";
import { ComposerRemoteAgentPicker } from "@/components/remote-agent-picker";
import { Icon } from "@/components/ui/icon";
import { preferSendOnTextReplyPark } from "@/src/composer-hitl";
import { TEXT_METRICS, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  focusComposerInput,
  registerComposerInputFocus,
} from "@/src/composer-input-focus";
import { KeyboardController } from "@/src/keyboard-controller";
import {
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import * as Haptics from "expo-haptics";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { ArrowUpIcon, AudioLinesIcon } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
  type TextInputInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const iosComposerHitSlop = composerControlHitSlop;

const lightComposerImpact = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

const ComposerInputHeightContext =
  createContext<SharedValue<number> | null>(null);

export type ComposerDockProps = {
  floats: boolean;
  waitingAction: WaitingAction | null | undefined;
  /**
   * Free-text ask_question park — keep the normal composer, but prefer Send
   * over Stop once the draft has a reply.
   */
  textReplyPending?: boolean;
  autoFocus?: boolean;
  focusNewChatKey: number;
  conversationId?: string | null;
};

/** Floating composer inset; lives under `IosKeyboardLayout` so it can track the keyboard. */
export const ComposerDock: FC<ComposerDockProps> = ({
  floats,
  waitingAction,
  textReplyPending = false,
  autoFocus,
  focusNewChatKey,
  conversationId,
}) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useComposerChrome();
  const safeBottom = insets.bottom;
  const minimizedBottom = Math.max(COMPOSER_MINIMIZED_BOTTOM_GAP, safeBottom - 8);
  const hitlActive = waitingAction != null;
  // Side inset follows chrome (sticky keeps full width while menus are open);
  // bottom pad still tracks the real keyboard so the dock sits correctly.
  const dockStyle = useAnimatedStyle(() => {
    if (!floats) {
      return { paddingBottom: safeBottom + 8 };
    }
    const live = chromeApi?.liveActive.value ?? 0;
    // Live call and HITL keep the expanded floating inset (no mini-player tuck).
    if (live > 0.5 || hitlActive) {
      return {
        paddingHorizontal: COMPOSER_EDGE,
        paddingBottom: minimizedBottom,
      };
    }
    const lifted = keyboardHeight?.value ?? 0;
    const span = keyboardSpan?.value ?? COMPOSER_MORPH_RANGE;
    const width = composerWidthProgress(
      chromeApi?.widthProgress.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      chromeApi?.textExpanded.value ?? 0,
    );
    const keyboardProgress = composerKeyboardProgress(lifted, span);
    // Monotonic: tuck near the home indicator when closed, then a fixed
    // float above the keyboard spacer — no dip/rise mid-drag.
    return {
      paddingHorizontal: interpolate(
        width,
        [0, 1],
        [COMPOSER_MINIMIZED_EDGE, COMPOSER_EDGE],
        Extrapolation.CLAMP,
      ),
      paddingBottom: interpolate(
        keyboardProgress,
        [0, 1],
        [minimizedBottom, COMPOSER_EDGE],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      pointerEvents={floats ? "box-none" : undefined}
      className={
        floats ? "aui-thread-viewport-footer" : "aui-thread-viewport-footer px-4"
      }
      style={[dockStyle, { overflow: "visible" }]}
    >
      <Composer
        autoFocus={autoFocus}
        focusNewChatKey={focusNewChatKey}
        conversationId={conversationId}
        waitingAction={waitingAction}
        textReplyPending={textReplyPending}
      />
    </Animated.View>
  );
};

// The placeholder color is a class to prop mapping that reads the CSSOM, so it applies from the first render after hydration.
const DefaultComposerInput: FC<{ autoFocus?: boolean }> = ({ autoFocus }) => {
  const hydrated = useHydrated();
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const expandedHeight = useContext(ComposerInputHeightContext);
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useComposerChrome();
  const { width: windowWidth } = useWindowDimensions();
  // Ignore content-size reports from the narrow collapsed frame (~mini width).
  const minExpandedMeasureWidth = Math.max(
    180,
    windowWidth - COMPOSER_MINIMIZED_EDGE * 2 - 48,
  );
  // The field owns its text while a keystroke is in flight. The AUI store lags
  // under fast iOS input; writing that stale value back restored characters
  // the user had just deleted and jumped the caret. Accept an external write
  // (send clears the field, a draft replaces it) once the store is no longer
  // echoing our own edit. An empty store always wins so send can clear a
  // keystroke that has not echoed yet.
  const [value, setValue] = useState(storeText);
  const publishedRef = useRef(storeText);
  const awaitingEchoRef = useRef(false);
  const nativeInput = useRef<TextInputInstance>(null);
  // Short fields pass downward drags to the dismiss ScrollView; only scroll
  // the UITextView once text fills the expanded max height.
  const [inputScrolls, setInputScrolls] = useState(false);
  const heightTarget = useRef(COMPOSER_EXPANDED_INPUT_MIN);
  const textOpenTarget = useRef(0);
  const settleHeight = (next: number) => {
    if (!expandedHeight || Math.abs(heightTarget.current - next) < 1) return;
    heightTarget.current = next;
    expandedHeight.value = withTiming(next, COMPOSER_SIZE_TIMING);
  };
  const settleTextOpen = (open: number) => {
    if (!chromeApi || textOpenTarget.current === open) return;
    textOpenTarget.current = open;
    chromeApi.textExpanded.value = withTiming(open, COMPOSER_SIZE_TIMING);
  };
  useEffect(() => {
    if (storeText === publishedRef.current) {
      awaitingEchoRef.current = false;
      return;
    }
    if (awaitingEchoRef.current && storeText !== "") return;
    publishedRef.current = storeText;
    awaitingEchoRef.current = false;
    setValue(storeText);
  }, [storeText]);
  // iOS reports the view bounds as content size and skips the event when a
  // line is deleted. Count wrapped lines so the field can grow and shrink
  // without chasing its own height.
  useEffect(() => {
    if (!expandedHeight) return;
    if (value.length === 0) {
      settleHeight(COMPOSER_EXPANDED_INPUT_MIN);
      settleTextOpen(0);
      setInputScrolls((current) => (current ? false : current));
      return;
    }
    const inputWidth = Math.max(160, windowWidth - COMPOSER_EDGE * 2 - 32);
    const charsPerLine = Math.max(12, Math.floor(inputWidth / 8.4));
    let lines = 0;
    for (const line of value.split("\n")) {
      lines += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    const estimated = Math.min(
      COMPOSER_EXPANDED_INPUT_MAX,
      Math.max(COMPOSER_EXPANDED_INPUT_MIN, lines * 22 + 12),
    );
    settleHeight(estimated);
    settleTextOpen(lines > 1 ? 1 : 0);
    const atMax = estimated >= COMPOSER_EXPANDED_INPUT_MAX;
    setInputScrolls((current) => (current === atMax ? current : atMax));
  }, [expandedHeight, value, windowWidth, chromeApi]);
  const placeholderColor =
    Platform.OS === "ios"
      ? "accent-muted-foreground/85"
      : "accent-muted-foreground/60";
  // Vertical pad morphs with chrome: centered in the mini row, top-aligned when open.
  const iosPadStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    return {
      paddingTop: interpolate(
        progress,
        [0, 1],
        [COMPOSER_COLLAPSED_INPUT_PAD_Y, 6],
      ),
      paddingBottom: interpolate(
        progress,
        [0, 1],
        [COMPOSER_COLLAPSED_INPUT_PAD_Y, 2],
      ),
    };
  });
  const scheme = useColorScheme();
  const placeholderInk =
    scheme === "dark" ? "rgba(235,235,245,0.62)" : "rgba(60,60,67,0.55)";
  // Gone for the whole morph so it never sits on the model button, then back at rest.
  const placeholderFade = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    return { opacity: composerPlaceholderOpacity(progress) };
  });
  // Native TextInput often ignores Tailwind type classes for the caret glyph /
  // placeholder — pin the message size so "Ask anything" matches thread prose.
  const composerTypeStyle = {
    fontSize: TEXT_METRICS.label.fontSize,
    lineHeight: 22,
  } as const;
  const inputProps = {
    placeholder: "Ask anything",
    placeholderTextColorClassName: hydrated ? placeholderColor : undefined,
    className: cn(
      "aui-composer-input web:resize-none web:outline-none",
      // Label is 17/26 for thread prose; keep the dock on the tighter 22 leading.
      textVariants({ variant: "label" }),
      "leading-[22px]",
      Platform.OS === "ios"
        ? "h-full w-full pl-2 pr-2"
        : "min-h-10 max-h-48 px-2.5 py-1",
    ),
    multiline: true,
    textAlignVertical: "top" as const,
    accessibilityLabel: "Message input",
  };

  useEffect(() => {
    if (Platform.OS !== "ios" || !autoFocus) return;
    // ChatScreen gates autoFocus until transitionEnd so this runs after the
    // push — native autoFocus on mount races the stack animation.
    const timer = setTimeout(() => nativeInput.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    return registerComposerInputFocus(() => {
      nativeInput.current?.focus();
    });
  }, []);
  const [hideCaret, setHideCaret] = useState(false);
  const applyHideCaret = useCallback((hidden: boolean) => {
    setHideCaret(hidden);
  }, []);
  useAnimatedReaction(
    () => chromeApi?.keyboardDragging.value ?? 0,
    (dragging, previous) => {
      if (dragging === previous) return;
      runOnJS(applyHideCaret)(dragging > 0);
    },
  );

  return Platform.OS === "ios" ? (
    <>
      <AnimatedTextInput
        ref={nativeInput}
        value={value}
        onBlur={() => {
          // Keep expanded chrome while the keyboard is still up (shell taps
          // that briefly resign the field). Collapse only after the keyboard
          // is gone — interactive drag-dismiss owns the intentional collapse.
          if (KeyboardController.isVisible()) return;
          chromeApi?.scheduleCollapse();
        }}
        onChangeText={(next) => {
          publishedRef.current = next;
          awaitingEchoRef.current = true;
          setValue(next);
          aui.composer.setText(next);
          if (next.length === 0) {
            setInputScrolls(false);
            settleHeight(COMPOSER_EXPANDED_INPUT_MIN);
            settleTextOpen(0);
          }
        }}
        onContentSizeChange={(event) => {
          if (!expandedHeight) return;
          // Empty field stays one line. A narrow collapsed frame wraps the
          // placeholder and reports a tall size that then collapses.
          if (value.length === 0) {
            settleHeight(COMPOSER_EXPANDED_INPUT_MIN);
            settleTextOpen(0);
            setInputScrolls((current) => (current ? false : current));
            return;
          }
          const { height, width } = event.nativeEvent.contentSize;
          const rejected = width > 0 && width < minExpandedMeasureWidth - 24;
          // contentSize already includes the field's vertical padding. Ignore
          // a report that only echoes the frame or the height we already chose.
          const contentH = Math.ceil(height);
          const echo =
            Math.abs(contentH - expandedHeight.value) <= 1 ||
            Math.abs(contentH - heightTarget.current) <= 1;
          const next = Math.min(
            COMPOSER_EXPANDED_INPUT_MAX,
            Math.max(COMPOSER_EXPANDED_INPUT_MIN, contentH),
          );
          if (rejected || echo) return;
          settleHeight(next);
          const atMax = contentH >= COMPOSER_EXPANDED_INPUT_MAX;
          setInputScrolls((current) => (current === atMax ? current : atMax));
        }}
        scrollEnabled={inputScrolls}
        {...inputProps}
        caretHidden={hideCaret}
        placeholder=""
        style={[iosPadStyle, composerTypeStyle]}
      />
      {value.length === 0 ? (
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[
            placeholderFade,
            iosPadStyle,
            composerTypeStyle,
            {
              position: "absolute",
              left: 8,
              right: 8,
              top: 0,
              color: placeholderInk,
            },
          ]}
        >
          Ask anything
        </Animated.Text>
      ) : null}
    </>
  ) : (
    <ComposerPrimitive.Input
      autoFocus={autoFocus}
      {...inputProps}
      style={composerTypeStyle}
    />
  );
};

const Composer: FC<{
  autoFocus?: boolean;
  focusNewChatKey: number;
  conversationId?: string | null;
  waitingAction?: WaitingAction | null;
  textReplyPending?: boolean;
}> = ({
  autoFocus,
  focusNewChatKey,
  conversationId = null,
  waitingAction = null,
  textReplyPending = false,
}) => {
  const { ComposerInput = DefaultComposerInput } = useContext(
    ThreadComponentsContext,
  );
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useComposerChrome();
  // Prefer glass immediately; only swap to the solid card if Reduce
  // Transparency is actually on.
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const [preparingAttachment, setPreparingAttachment] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const motion = useMotion();
  const { width: windowWidth } = useWindowDimensions();
  const pressed = useSharedValue(0);
  // Cancels rubber-band scroll so the shell stays glued to the keyboard while
  // a downward drag dismisses it (UI-thread only — no async onLayout lag).
  const dismissScrollY = useSharedValue(0);
  const expandedHeight = useSharedValue(COMPOSER_EXPANDED_INPUT_MIN);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdActive = useRef(false);
  const openLive = useCallback(() => {
    chromeApi?.collapseNow();
    chromeApi?.setLiveActive(true);
    dismissKeyboard();
    setLiveOpen(true);
  }, [chromeApi]);
  const closeLive = useCallback(() => {
    chromeApi?.setLiveActive(false);
    setLiveOpen(false);
  }, [chromeApi]);
  const dismissComposerKeyboard = useCallback(() => {
    chromeApi?.collapseNow();
    void KeyboardController.dismiss();
  }, [chromeApi]);
  const onDismissScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      dismissScrollY.value = event.contentOffset.y;
    },
  });
  const onDismissScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!KeyboardController.isVisible()) return;
      const { contentOffset, velocity } = event.nativeEvent;
      // Quick flick or deep rubber-band on the composer finishes the dismiss
      // so the keyboard does not snap back when interactive drag falls short.
      if (contentOffset.y < -28 || (velocity?.y ?? 0) < -0.6) {
        dismissComposerKeyboard();
      }
    },
    [dismissComposerKeyboard],
  );
  const dismissPinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissScrollY.value }],
  }));
  useEffect(() => {
    if (!CAN_USE_LIQUID_GLASS) return;
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReducedTransparency,
    );
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReducedTransparency(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      chromeApi?.setLiveActive(false);
    },
    [chromeApi],
  );
  const showGlass = CAN_USE_LIQUID_GLASS && !reducedTransparency;
  const scheme = useColorScheme();
  const glassShadow =
    scheme === "dark" ? LIQUID_GLASS_SHADOW_DARK : LIQUID_GLASS_SHADOW_LIGHT;
  const holdEnabled = Platform.OS === "ios" && motion;

  // Outer chrome pulses slightly while expanded; never transform the TextInput.
  const outerPressStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    const bump = composerPressBump(progress, pressed.value, holdEnabled);
    return {
      overflow: "visible" as const,
      transform: [{ scale: bump }],
    };
  });

  const shellStyle = useAnimatedStyle(() => {
    const progress =
      Platform.OS === "ios" && keyboardHeight
        ? composerChromeProgress(
            keyboardHeight.value,
            chromeApi?.stickyExpanded.value ?? 0,
            keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
            chromeApi?.textExpanded.value ?? 0,
          )
        : 1;
    // Collapsed hold shrink only — scaling the focused field dismisses the keyboard.
    const holdScale = composerHoldScale(progress, pressed.value, holdEnabled);
    return {
      paddingTop: interpolate(progress, [0, 1], [6, 8]),
      paddingBottom: interpolate(progress, [0, 1], [6, 6]),
      paddingHorizontal: 8,
      transform: [{ scale: holdScale }],
    };
  });

  const inputSpacerStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    return {
      height: interpolate(progress, [0, 1], [0, expandedHeight.value]),
    };
  });

  const actionRowStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    return {
      // Was 16 — left a tall empty gutter under a one-line Ask anything.
      marginTop: interpolate(progress, [0, 1], [0, 6]),
      height: COMPOSER_MIN_INPUT,
      alignItems: "center" as const,
    };
  });

  const inputFrameStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    // Positioned inside the in-flow stack (not the shell), so top:0 lines up
    // with the spacer/action row — avoids padding-box drift that left the
    // collapsed field sitting high in the pill.
    const width = composerWidthProgress(
      chromeApi?.widthProgress.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      chromeApi?.textExpanded.value ?? 0,
    );
    const frame = composerInputWidth(windowWidth, width);
    return {
      position: "absolute" as const,
      left: frame.left,
      width: frame.width,
      top: 0,
      height: interpolate(
        progress,
        [0, 1],
        [COMPOSER_MIN_INPUT, expandedHeight.value],
      ),
      zIndex: 2,
    };
  });

  // Parent onTouch* observes child touches without the touch-delay RNGH would
  // put on the text field and SwiftUI menus.
  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (!holdActive.current) return;
    holdActive.current = false;
    pressed.value = withSpring(0, COMPOSER_HOLD_SPRING);
  }, [pressed]);

  const beginHold = useCallback(() => {
    if (!holdEnabled) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    // Keyboard up: light outer scale + refocus so shell taps do not collapse.
    if (
      KeyboardController.isVisible() ||
      (chromeApi?.stickyExpanded.value ?? 0) > 0.5
    ) {
      holdActive.current = true;
      pressed.value = withSpring(1, COMPOSER_HOLD_SPRING);
      focusComposerInput();
      return;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      holdActive.current = true;
      pressed.value = withSpring(1, COMPOSER_HOLD_SPRING);
      lightComposerImpact();
    }, 120);
  }, [chromeApi, holdEnabled, pressed]);

  const solidSurface = (
    <View
      pointerEvents="none"
      className="border-border/60 dark:border-muted-foreground/15 bg-card absolute inset-0 border"
      style={COMPOSER_SHELL_STYLE}
    />
  );

  // Live voice is a full-screen takeover (ChatGPT-style). Keep the composer
  // tree mounted underneath so closing voice can refocus Ask Pearl.
  const liveOverlay = liveOpen ? <LiveSession onClose={closeLive} /> : null;

  // HITL morphs the same glass shell into the response surface (options / text).
  // Attach, Ask anything, and voice stay hidden until the pause resolves.
  if (waitingAction) {
    return (
      <>
        {liveOverlay}
        <ComposerPrimitive.Root className="aui-composer-root w-full">
          <View
            style={[
              {
                overflow: "visible",
                borderRadius: COMPOSER_SHELL_RADIUS,
                borderCurve: "continuous",
              },
              glassShadow,
            ]}
          >
            <View
              className="aui-composer-shell relative p-3"
              style={COMPOSER_SHELL_STYLE}
            >
              {showGlass ? (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  isInteractive
                  style={GLASS_SURFACE_STYLE}
                />
              ) : (
                solidSurface
              )}
              <WaitingActionCard action={waitingAction} variant="composer" />
            </View>
          </View>
        </ComposerPrimitive.Root>
      </>
    );
  }

  if (Platform.OS !== "ios") {
    return (
      <>
        {liveOverlay}
        <ComposerPrimitive.Root className="aui-composer-root w-full">
          <Animated.View
            className="aui-composer-shell relative gap-2 p-2"
            style={COMPOSER_SHELL_STYLE}
          >
            {showGlass ? (
              <GlassView
                pointerEvents="none"
                glassEffectStyle="regular"
                isInteractive
                style={GLASS_SURFACE_STYLE}
              />
            ) : (
              solidSurface
            )}
            <ComposerAttachments conversationId={conversationId} />
            <ComposerInput key={focusNewChatKey} autoFocus={autoFocus} />
            <View className="aui-composer-action-wrapper flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <ComposerAddAttachment
                  preparing={preparingAttachment}
                  onPreparingChange={setPreparingAttachment}
                  conversationId={conversationId}
                />
                <ComposerRemoteAgentPicker disabled={preparingAttachment} />
              </View>
              <ComposerTrailingControls
                preparingAttachment={preparingAttachment}
                onOpenLive={openLive}
                textReplyPending={textReplyPending}
              />
            </View>
          </Animated.View>
        </ComposerPrimitive.Root>
      </>
    );
  }

  // iOS morph: collapsed mini-player row ↔ full composer (input above, actions below).
  // One TextInput is absolutely positioned so keyboard drag never remounts it.
  return (
    <>
      {liveOverlay}
      <ComposerInputHeightContext.Provider value={expandedHeight}>
        <Animated.ScrollView
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="always"
          alwaysBounceVertical
          bounces
          scrollsToTop={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          directionalLockEnabled
          onScroll={onDismissScroll}
          onScrollEndDrag={onDismissScrollEndDrag}
          // Do not clip the hold-grow or the drop shadow against the dock.
          style={{ overflow: "visible" }}
        >
          <Animated.View style={dismissPinStyle}>
            <ComposerPrimitive.Root className="aui-composer-root w-full">
              <Animated.View
                style={[
                  {
                    overflow: "visible",
                    borderRadius: COMPOSER_SHELL_RADIUS,
                    borderCurve: "continuous",
                  },
                  glassShadow,
                  outerPressStyle,
                ]}
              >
                <Animated.View
                  className="aui-composer-shell relative"
                  style={[COMPOSER_SHELL_STYLE, shellStyle]}
                  onTouchStart={holdEnabled ? beginHold : undefined}
                  onTouchEnd={holdEnabled ? clearHold : undefined}
                  onTouchCancel={holdEnabled ? clearHold : undefined}
                >
                  {showGlass ? (
                    <GlassView
                      pointerEvents="none"
                      glassEffectStyle="regular"
                      isInteractive
                      style={GLASS_SURFACE_STYLE}
                    />
                  ) : (
                    solidSurface
                  )}
                  <ComposerAttachments conversationId={conversationId} />
                  <View collapsable={false}>
                    <Animated.View
                      pointerEvents="none"
                      style={inputSpacerStyle}
                    />
                    <Animated.View
                      className="aui-composer-action-wrapper flex-row items-center"
                      style={actionRowStyle}
                    >
                      <ComposerAddAttachment
                        preparing={preparingAttachment}
                        onPreparingChange={setPreparingAttachment}
                        conversationId={conversationId}
                      />
                      <ComposerRemoteAgentPicker
                        disabled={preparingAttachment}
                      />
                      <View
                        style={{ flexGrow: 1, flexBasis: 0, minWidth: 8 }}
                      />
                      <ComposerTrailingControls
                        preparingAttachment={preparingAttachment}
                        onOpenLive={openLive}
                        textReplyPending={textReplyPending}
                      />
                    </Animated.View>
                    <Animated.View style={inputFrameStyle}>
                      <ComposerInput
                        key={focusNewChatKey}
                        autoFocus={autoFocus}
                      />
                    </Animated.View>
                  </View>
                </Animated.View>
              </Animated.View>
            </ComposerPrimitive.Root>
          </Animated.View>
        </Animated.ScrollView>
      </ComposerInputHeightContext.Provider>
    </>
  );
};

const ComposerTrailingControls: FC<{
  preparingAttachment: boolean;
  onOpenLive: () => void;
  textReplyPending?: boolean;
}> = ({ preparingAttachment, onOpenLive, textReplyPending = false }) => {
  // The stop control only cancels the send while no run it could stop is going.
  const isSending = useAuiState(
    (s) =>
      s.composer.submission !== undefined &&
      !(s.thread.isRunning && s.thread.capabilities.cancel),
  );
  const canSend = useAuiState(
    (s) =>
      !s.composer.isEmpty &&
      s.composer.canSend &&
      (!s.thread.isRunning ||
        s.thread.capabilities.queue ||
        s.thread.voice !== undefined ||
        textReplyPending),
  );
  const isEmpty = useAuiState((s) => s.composer.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const hasVoice = useAuiState((s) => s.thread.voice !== undefined);
  const hasSubmission = useAuiState((s) => s.composer.submission !== undefined);
  const preferSendWhileRunning = preferSendOnTextReplyPark({
    textReplyPending,
    composerEmpty: isEmpty,
    canSend,
  });
  const showSendOrLive =
    !hasSubmission && (!isRunning || hasVoice || preferSendWhileRunning);
  const showCancel = !showSendOrLive;
  const isIos = Platform.OS === "ios";

  return (
    <View className="flex-row items-center">
      {showSendOrLive ? (
        isEmpty ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start live conversation"
            disabled={preparingAttachment}
            onPress={onOpenLive}
            hitSlop={isIos ? iosComposerHitSlop : iconButtonHitSlop}
            className={cn(
              "aui-composer-live items-center justify-center",
              isIos
                ? "size-8"
                : "bg-primary active:bg-primary/90 size-11 rounded-full disabled:opacity-50",
            )}
            style={preparingAttachment ? { opacity: 0.5 } : undefined}
          >
            {isIos ? (
              <View className="size-8 items-center justify-center rounded-full border border-border/60 bg-primary">
                <Icon
                  as={AudioLinesIcon}
                  className="size-5 text-primary-foreground"
                />
              </View>
            ) : (
              <Icon
                as={AudioLinesIcon}
                className="text-primary-foreground size-4"
              />
            )}
          </Pressable>
        ) : (
          <ComposerPrimitive.Send
            disabled={preparingAttachment || (isIos && !canSend)}
            className={cn(
              "aui-composer-send items-center justify-center",
              isIos
                ? "size-8"
                : "bg-primary active:bg-primary/90 size-11 rounded-full disabled:opacity-50",
            )}
            hitSlop={isIos ? iosComposerHitSlop : iconButtonHitSlop}
            accessibilityLabel="Send message"
          >
            {isIos ? (
              <View className="size-8 items-center justify-center rounded-full border border-border/60 bg-primary">
                <Icon
                  as={ArrowUpIcon}
                  className={cn(
                    "aui-composer-send-icon size-5",
                    canSend && !preparingAttachment
                      ? "text-primary-foreground"
                      : "text-primary-foreground/50",
                  )}
                />
              </View>
            ) : (
              <Icon
                as={ArrowUpIcon}
                className="aui-composer-send-icon text-primary-foreground size-4"
              />
            )}
          </ComposerPrimitive.Send>
        )
      ) : null}
      {showCancel ? (
        <ComposerPrimitive.Cancel
          className={cn(
            "aui-composer-cancel items-center justify-center",
            isIos
              ? "size-8"
              : "bg-primary active:bg-primary/90 size-11 rounded-full",
          )}
          hitSlop={isIos ? iosComposerHitSlop : iconButtonHitSlop}
          accessibilityLabel={
            isSending ? "Cancel sending" : "Stop generating"
          }
        >
          {isIos ? (
            <View className="size-8 items-center justify-center rounded-full border border-border/60 bg-primary">
              <View className="aui-composer-cancel-icon size-2.5 rounded-[2px] bg-primary-foreground" />
            </View>
          ) : (
            <View className="aui-composer-cancel-icon bg-primary-foreground size-3 rounded-[2px]" />
          )}
        </ComposerPrimitive.Cancel>
      ) : null}
    </View>
  );
};
