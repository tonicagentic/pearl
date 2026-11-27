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
  estimateComposerInputHeight,
} from "@/components/assistant-ui/elements/composer-morph";
import {
  ProjectMentionChip,
  ProjectMentionMenu,
} from "@/components/assistant-ui/elements/composer-project-mention";
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
import { resolveComposerTrailingMode } from "@/src/composer-hitl";
import { TEXT_METRICS, Text, textVariants } from "@/components/ui/text";
import {
  deleteChipBeforeCaret,
  draftPartsFromText,
  insertProjectMention,
  serializeDraftParts,
  trailingMentionQuery,
  type ComposerDraftPart,
} from "../../../../lib/chat/project-mentions";
import { cn } from "@/lib/utils";
import { useActiveChat } from "@/src/chat-context";
import {
  focusComposerInput,
  registerComposerInputFocus,
} from "@/src/composer-input-focus";
import { KeyboardController } from "@/src/keyboard-controller";
import { queryKeys } from "@/src/query-client";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import {
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import { useQuery } from "@tanstack/react-query";
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
  useMemo,
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
  type TextInputKeyPressEvent,
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

type MentionMenuState = {
  readonly open: boolean;
  readonly query: string;
};

type ComposerMentionApi = {
  readonly setMenu: (next: MentionMenuState) => void;
  readonly selectProject: (project: ProjectDto) => void;
  readonly registerSelectHandler: (
    handler: ((project: ProjectDto) => void) | null,
  ) => void;
};

const ComposerMentionContext = createContext<ComposerMentionApi | null>(null);

function useComposerMention(): ComposerMentionApi | null {
  return useContext(ComposerMentionContext);
}

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

const COMPOSER_PLACEHOLDER_NAME_MAX = 28;

function composerPlaceholderForProject(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "Ask anything";
  const label =
    trimmed.length > COMPOSER_PLACEHOLDER_NAME_MAX
      ? `${trimmed.slice(0, COMPOSER_PLACEHOLDER_NAME_MAX - 1)}…`
      : trimmed;
  return `Message ${label}`;
}

// The placeholder color is a class to prop mapping that reads the CSSOM, so it applies from the first render after hydration.
const DefaultComposerInput: FC<{ autoFocus?: boolean }> = ({ autoFocus }) => {
  const hydrated = useHydrated();
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const { activeProjectId } = useActiveChat();
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
    enabled: Boolean(activeProjectId),
    staleTime: 30_000,
  });
  const placeholder = useMemo(() => {
    if (!activeProjectId) return "Ask anything";
    const name = projectsQuery.data?.find(
      (project) => project.id === activeProjectId,
    )?.name;
    // Keep “Message …” once a project is attached, even before the name loads.
    return composerPlaceholderForProject(name ?? "project");
  }, [activeProjectId, projectsQuery.data]);
  const expandedHeight = useContext(ComposerInputHeightContext);
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useComposerChrome();
  const mentionApi = useComposerMention();
  const { width: windowWidth } = useWindowDimensions();
  // Draft parts keep project chips out of the TextInput. The store holds the
  // serialized directive string; ignore echo of our own publishes, clear on
  // empty store (send), and re-parse any other external write.
  const [parts, setParts] = useState<ComposerDraftPart[]>(() =>
    draftPartsFromText(storeText),
  );
  const publishedRef = useRef(storeText);
  const awaitingEchoRef = useRef(false);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const nativeInput = useRef<TextInputInstance>(null);
  const [inputScrolls, setInputScrolls] = useState(false);
  const heightTarget = useRef(COMPOSER_EXPANDED_INPUT_MIN);
  const textOpenTarget = useRef(0);

  const lastPart = parts[parts.length - 1];
  const activeText = lastPart?.kind === "text" ? lastPart.text : "";
  const leadingParts = parts.slice(0, -1);
  const hasChips = leadingParts.some((part) => part.kind === "project");
  const isBlank = !hasChips && activeText.length === 0;
  const mentionQuery = trailingMentionQuery(activeText);

  const publishParts = useCallback(
    (nextParts: ComposerDraftPart[]) => {
      const normalized =
        nextParts.length > 0 && nextParts[nextParts.length - 1]?.kind === "text"
          ? nextParts
          : [...nextParts, { kind: "text" as const, text: "" }];
      const serialized = serializeDraftParts(normalized);
      publishedRef.current = serialized;
      awaitingEchoRef.current = true;
      partsRef.current = normalized;
      setParts(normalized);
      aui.composer.setText(serialized);
    },
    [aui],
  );

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
    setParts(draftPartsFromText(storeText));
  }, [storeText]);

  useEffect(() => {
    mentionApi?.setMenu({
      open: mentionQuery !== null,
      query: mentionQuery ?? "",
    });
  }, [mentionApi, mentionQuery]);

  useEffect(() => {
    if (!mentionApi) return;
    mentionApi.registerSelectHandler((project) => {
      const next = insertProjectMention(partsRef.current, {
        id: project.id,
        label: project.name,
      });
      publishParts(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {},
      );
      requestAnimationFrame(() => nativeInput.current?.focus());
    });
    return () => mentionApi.registerSelectHandler(null);
  }, [mentionApi, publishParts]);

  // Own height from wrapped line count. iOS content-size reports the current
  // frame and restarts withTiming against that estimate (flash on wrap, stuck
  // tall on delete), so do not settle from onContentSizeChange.
  useEffect(() => {
    if (!expandedHeight) return;
    if (isBlank) {
      settleHeight(COMPOSER_EXPANDED_INPUT_MIN);
      settleTextOpen(0);
      setInputScrolls((current) => (current ? false : current));
      return;
    }
    const { height, lines } = estimateComposerInputHeight({
      text: activeText,
      windowWidth,
      hasChips,
    });
    settleHeight(height);
    settleTextOpen(lines > 1 || hasChips ? 1 : 0);
    const atMax = height >= COMPOSER_EXPANDED_INPUT_MAX;
    setInputScrolls((current) => (current === atMax ? current : atMax));
  }, [
    activeText,
    expandedHeight,
    hasChips,
    isBlank,
    windowWidth,
    chromeApi,
  ]);

  const placeholderColor =
    Platform.OS === "ios"
      ? "accent-muted-foreground/85"
      : "accent-muted-foreground/60";
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
  const placeholderFade = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
      keyboardSpan?.value ?? COMPOSER_MORPH_RANGE,
      chromeApi?.textExpanded.value ?? 0,
    );
    return { opacity: composerPlaceholderOpacity(progress) };
  });
  const composerTypeStyle = {
    fontSize: TEXT_METRICS.label.fontSize,
    lineHeight: 22,
  } as const;

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => nativeInput.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
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

  const onChangeText = (next: string) => {
    const head = partsRef.current.slice(0, -1);
    publishParts([...head, { kind: "text", text: next }]);
    if (next.length === 0 && head.length === 0) {
      setInputScrolls(false);
      settleHeight(COMPOSER_EXPANDED_INPUT_MIN);
      settleTextOpen(0);
    }
  };

  const onKeyPress = (event: TextInputKeyPressEvent) => {
    if (event.nativeEvent.key !== "Backspace") return;
    if (activeText.length > 0) return;
    const next = deleteChipBeforeCaret(partsRef.current);
    if (!next) return;
    event.preventDefault?.();
    publishParts(next);
  };

  const inputClassName = cn(
    "aui-composer-input web:resize-none web:outline-none",
    textVariants({ variant: "label" }),
    "leading-[22px]",
    hasChips ? "min-w-[48px] flex-1 py-0.5 pl-1 pr-2" : "h-full w-full pl-2 pr-2",
  );

  const field = (
    <AnimatedTextInput
      ref={nativeInput}
      value={activeText}
      onBlur={() => {
        // Do not close the @ menu here — a menu tap blurs the field first and
        // would unmount the row before onPress. The menu closes when the
        // trailing @query clears or a project is picked.
        if (KeyboardController.isVisible()) return;
        chromeApi?.scheduleCollapse();
      }}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      scrollEnabled={inputScrolls}
      placeholder=""
      placeholderTextColorClassName={hydrated ? placeholderColor : undefined}
      className={inputClassName}
      multiline
      textAlignVertical="top"
      accessibilityLabel={placeholder}
      caretHidden={hideCaret}
      style={[
        hasChips ? undefined : iosPadStyle,
        composerTypeStyle,
        hasChips ? { minHeight: 28 } : undefined,
      ]}
    />
  );

  return (
    <View className="relative min-h-full w-full justify-center">
      {hasChips ? (
        <View className="w-full flex-row flex-wrap items-center gap-1 px-1 pt-1">
          {leadingParts.map((part, index) =>
            part.kind === "project" ? (
              <ProjectMentionChip
                key={`chip-${part.id}-${index}`}
                name={part.label}
              />
            ) : part.text.length > 0 ? (
              <Text
                key={`text-${index}`}
                variant="label"
                className="text-foreground leading-[22px]"
              >
                {part.text}
              </Text>
            ) : null,
          )}
          {field}
        </View>
      ) : (
        <>
          {field}
          {isBlank ? (
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
              {placeholder}
            </Animated.Text>
          ) : null}
        </>
      )}
    </View>
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
  const [mentionMenu, setMentionMenu] = useState<MentionMenuState>({
    open: false,
    query: "",
  });
  const selectHandlerRef = useRef<((project: ProjectDto) => void) | null>(
    null,
  );
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
    enabled: mentionMenu.open,
    staleTime: 30_000,
  });
  const mentionApi = useMemo<ComposerMentionApi>(
    () => ({
      setMenu: setMentionMenu,
      selectProject: (project) => {
        selectHandlerRef.current?.(project);
        setMentionMenu({ open: false, query: "" });
      },
      registerSelectHandler: (handler) => {
        selectHandlerRef.current = handler;
      },
    }),
    [],
  );
  const motion = useMotion();
  const { width: windowWidth } = useWindowDimensions();
  const pressed = useSharedValue(0);
  const mentionMenuNode = (
    <ProjectMentionMenu
      open={mentionMenu.open}
      query={mentionMenu.query}
      projects={projectsQuery.data ?? []}
      loading={projectsQuery.isPending && !projectsQuery.data}
      onSelect={mentionApi.selectProject}
    />
  );
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
      <ComposerMentionContext.Provider value={mentionApi}>
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
      </ComposerMentionContext.Provider>
    );
  }

  if (Platform.OS !== "ios") {
    return (
      <ComposerMentionContext.Provider value={mentionApi}>
        {liveOverlay}
        <ComposerPrimitive.Root className="aui-composer-root relative w-full">
          {mentionMenuNode}
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
      </ComposerMentionContext.Provider>
    );
  }

  // iOS morph: collapsed mini-player row ↔ full composer (input above, actions below).
  // One TextInput is absolutely positioned so keyboard drag never remounts it.
  // The @ menu sits on the outer overflow-visible frame so the shell clip
  // does not hide it.
  return (
    <ComposerMentionContext.Provider value={mentionApi}>
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
                {mentionMenuNode}
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
    </ComposerMentionContext.Provider>
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
  const { showSendOrLive, showCancel } = resolveComposerTrailingMode({
    textReplyPending,
    composerEmpty: isEmpty,
    canSend,
    isRunning,
    hasVoice,
    hasSubmission,
  });
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
