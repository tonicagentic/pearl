import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import {
  ComposerChromeContext,
  type ComposerChromeApi,
} from "@/components/assistant-ui/elements/composer-chrome";
import { ComposerOwnsHitlContext } from "@/components/assistant-ui/elements/composer-owns-hitl";
import { ComposerRemoteAgentPicker } from "@/components/remote-agent-picker";
import {
  composerControlHitSlop,
  groupedIconButtonHitSlop,
  iconButtonClassName,
  iconButtonHitSlop,
} from "@/components/assistant-ui/elements/icon-button";
import { File } from "@/components/assistant-ui/elements/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import { AssistantInlineText } from "@/components/json-render/chat-json-render";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { proseFromMessageText } from "../../../../lib/json-render/inline-spec";
import {
  SessionTimelineSegment,
  isTimelineToolCall,
  lastTimelineBlockIndex,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/components/assistant-ui/elements/session-timeline";
import { SessionTodoList } from "@/components/assistant-ui/elements/todo-list";
import { TaskGroup, DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import { AssistantThinking } from "@/components/assistant-ui/elements/assistant-thinking";
import { TurnElapsedProvider } from "@/components/assistant-ui/elements/turn-elapsed";
import { MessageSources } from "@/components/assistant-ui/elements/citation";
import {
  ShimmerLabel,
  actionBarEnter,
  inkButton,
  messageEnter,
  useAnnounce,
  useHydrated,
  useMotion,
  webLiveRegion,
} from "@/components/assistant-ui/elements/surfaces";
import { MessageFileToolClaims } from "@/components/assistant-ui/elements/file-tool-claim";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback";
import { TypingIndicator } from "@/components/assistant-ui/elements/typing-indicator";
import { ThreadEdgeFades } from "@/components/assistant-ui/elements/thread-edge-fades";
import {
  WaitingActionCard,
  type WaitingAction,
} from "@/components/assistant-ui/elements/waiting-action-card";
import { isTaskNotification } from "@/src/message-projection";
import { dismissKeyboard } from "@/components/dismiss-keyboard";
import {
  focusComposerInput,
  registerComposerInputFocus,
} from "@/src/composer-input-focus";
import { LiveSession } from "@/components/live-session";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ThreadMessage as ThreadMessageType,
  type ToolCallMessagePartComponent,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import {
  ArrowUpIcon,
  AudioLinesIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  MicIcon,
  PhoneIcon,
  Share2Icon,
} from "lucide-react-native";
import {
  type ComponentRef,
  type ComponentType,
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AccessibilityInfo,
  type FlatList,
  type FlatListProps,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Share,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
  type TextInputInstance,
  type ViewProps,
} from "react-native";
import { TEXT_METRICS, Text, textVariants } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardController,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import Animated, {
  Easing,
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

const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  /** Renders tool calls that carry a nested conversation and have no registered UI; without it they render like any other tool call. */
  TaskGroup?: ComponentType<{ group: ThreadGroupPart }> | undefined;
  /** Replaces the text input of both the new message composer and the edit composer; read `composer.type` to tell them apart. */
  ComposerInput?: ComponentType | undefined;
  /** Overlays the message list, which keeps a gutter free along its left edge for it; it reads the list through `useThreadViewport`. Mounting or unmounting it remounts the list. */
  Rail?: ComponentType | undefined;
};

export type ThreadHistory = {
  /** Whether messages older than the loaded window exist. */
  readonly hasMore: boolean;
  /** Whether a page of older messages is on its way. */
  readonly isLoadingMore: boolean;
  /** Loads the next page of older messages above the window. */
  readonly loadMore: () => void;
};

export type ThreadProps = {
  autoFocus?: boolean | undefined;
  /** Reset bottom-follow when selecting a different conversation. */
  conversationId?: string | null | undefined;
  /** Remount only the input when entering a new chat, not on every render. */
  focusNewChatKey?: number | undefined;
  /**
   * When false, welcome + composer stay invisible (auth→chat morph). Defaults
   * to true for normal mounts and cold-start restore.
   */
  chromeRevealed?: boolean | undefined;
  /**
   * Override the floating-composer list top inset (defaults to status bar +
   * nav height). Use a small value when the thread sits under solid chrome
   * such as the Samples mode switcher.
   */
  contentPaddingTop?: number | undefined;
  components?: ThreadComponents | undefined;
  /** A windowed thread: the list asks for older messages when it reaches its start and shows the loading edge above them. */
  history?: ThreadHistory | undefined;
  /** Recovery belongs in the transcript, never in a bar that shifts the viewport. */
  notice?: { text: string; actionLabel?: string; onAction?: () => void } | null;
  /**
   * HITL pause that morphs the composer shell into the response surface:
   * authorization banner, approval buttons, choice options, or free-text.
   */
  waitingAction?: WaitingAction | null;
  /** Guest hit the free-message limit — don't steal focus into the composer. */
  signupBlocked?: boolean | undefined;
};

export type ThreadViewportSnapshot = {
  /** The ids of the messages on screen, in list order. */
  readonly visibleMessageIds: readonly string[];
  /**
   * Zero until the list is within one screenful of its end, then the share of
   * that stretch scrolled, so a reading line placed at this fraction of the
   * viewport can still reach the final turns.
   */
  readonly descent: number;
  /** The message list's height. */
  readonly height: number;
  /** The message list's offset from the top of the thread viewport, which grows while the history edge shows. */
  readonly top: number;
};

export type ThreadViewport = ThreadViewportSnapshot & {
  /** Scrolls the message list until the message starts at the top of the viewport. */
  readonly scrollToMessage: (id: string) => void;
};

type ThreadViewportStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => ThreadViewportSnapshot;
  readonly scrollToMessage: (id: string) => void;
};

const EMPTY_COMPONENTS: ThreadComponents = {};
const EMPTY_IDS: readonly string[] = [];
const IDLE_VIEWPORT: ThreadViewportSnapshot = {
  visibleMessageIds: EMPTY_IDS,
  descent: 0,
  height: 0,
  top: 0,
};
const MESSAGE_VIEWABILITY = {
  minimumViewTime: 0,
  viewAreaCoveragePercentThreshold: 0,
};
type ViewabilityInfo = Parameters<
  NonNullable<FlatListProps<ThreadMessageType>["onViewableItemsChanged"]>
>[0];
const SCROLL_RETRY_DELAY = 100;
const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();
const COMPOSER_SHELL_RADIUS = 26;
/** Side/bottom float for the iOS composer dock (Mail-style inset from the screen edge). */
const COMPOSER_EDGE = 16;
/** Extra side inset while collapsed so the mini-player bar doesn’t span edge-to-edge. */
const COMPOSER_MINIMIZED_EDGE = 28;
/** Idle (keyboard closed) tuck: sit nearer the home indicator than the expanded float. */
const COMPOSER_MINIMIZED_BOTTOM_GAP = 4;
/** Keyboard height range that morphs minimized ↔ expanded chrome (follows interactive drag). */
const COMPOSER_MORPH_RANGE = 120;
const COMPOSER_CHIP = 32;
const COMPOSER_ROW_GAP = 6;
/** Collapsed field/row height — match the + / Live chips for vertical centering. */
const COMPOSER_MIN_INPUT = COMPOSER_CHIP;
/** 17px / 22 leading centered in COMPOSER_MIN_INPUT. */
const COMPOSER_COLLAPSED_INPUT_PAD_Y = (COMPOSER_MIN_INPUT - 22) / 2;
const COMPOSER_EXPANDED_INPUT_MIN = 44;
const COMPOSER_EXPANDED_INPUT_MAX = 192;
/** Line-count changes ease instead of snapping the shell. */
const COMPOSER_SIZE_TIMING = {
  duration: 200,
  easing: Easing.out(Easing.cubic),
} as const;
const COMPOSER_SHELL_STYLE = {
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
const LIQUID_GLASS_SHADOW_LIGHT = {
  boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)",
} as const;
const LIQUID_GLASS_SHADOW_DARK = {
  boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.22)",
} as const;
const GLASS_SURFACE_STYLE = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  ...COMPOSER_SHELL_STYLE,
} as const;
const COMPOSER_HOLD_SPRING = { damping: 22, stiffness: 420 } as const;
const iosComposerHitSlop = composerControlHitSlop;

const lightComposerImpact = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const KeyboardHeightContext = createContext<SharedValue<number> | null>(null);
/** Full keyboard height, latched when a show starts, so a drag morphs across the whole travel. */
const KeyboardSpanContext = createContext<SharedValue<number> | null>(null);

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

/** 0 = minimized, 1 = expanded. Tracks the finger across the whole keyboard travel. */
function composerKeyboardProgress(keyboardHeight: number, span: number): number {
  "worklet";
  const range = Math.max(span, COMPOSER_MORPH_RANGE);
  return interpolate(keyboardHeight, [0, range], [0, 1], Extrapolation.CLAMP);
}

/** Expanded press grow. Fades out through halfway so the width does not pop. */
function composerPressBump(
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
function composerHoldScale(
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
function composerWidthProgress(
  widthProgress: number,
  stickyExpanded: number,
  textExpanded: number,
): number {
  "worklet";
  return Math.max(widthProgress, stickyExpanded, textExpanded);
}

/** Chrome morph: keyboard progress, held open while sticky after menus steal focus. */
function composerChromeProgress(
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
function composerInputWidth(windowWidth: number, progress: number): {
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
function composerPlaceholderOpacity(progress: number): number {
  "worklet";
  if (progress < 0.5) {
    return interpolate(progress, [0, 0.1], [1, 0], Extrapolation.CLAMP);
  }
  return interpolate(progress, [0.92, 1], [0, 1], Extrapolation.CLAMP);
}

const ThreadViewportContext = createContext<ThreadViewportStore>({
  subscribe: () => () => {},
  getSnapshot: () => IDLE_VIEWPORT,
  scrollToMessage: () => {},
});

const createViewportStore = () => {
  const listeners = new Set<() => void>();
  let snapshot = IDLE_VIEWPORT;

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    publish: (next: Partial<ThreadViewportSnapshot>) => {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener();
    },
  };
};

/** What the thread's message list shows right now, for an element that overlays it. */
export const useThreadViewport = (): ThreadViewport => {
  const { subscribe, getSnapshot, scrollToMessage } = useContext(
    ThreadViewportContext,
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({ ...snapshot, scrollToMessage }),
    [snapshot, scrollToMessage],
  );
};

const copyToClipboard = async (text: string) => {
  await Clipboard.setStringAsync(text);
};

export { WaitingActionCard } from "@/components/assistant-ui/elements/waiting-action-card";

export const Thread: FC<ThreadProps> = ({
  autoFocus = true,
  conversationId,
  focusNewChatKey = 0,
  chromeRevealed = true,
  contentPaddingTop,
  components = EMPTY_COMPONENTS,
  history,
  notice,
  waitingAction,
  signupBlocked = false,
}) => {
  const aui = useAui();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  // Resolve Reduce Motion before the first assistant text part mounts.
  useMotion();
  const insets = useSafeAreaInsets();
  const followsKeyboard = Platform.OS === "ios" && !Platform.isPad;
  const floatsComposer = Platform.OS === "ios";
  // Only bottom-docked iPhone keyboards use the spacer; keep other layouts unchanged.
  const viewportRef = useRef<ComponentRef<typeof View>>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(
    insets.bottom + COMPOSER_EDGE + 116,
  );
  const [store] = useState(createViewportStore);
  const listRef = useRef<FlatList<ThreadMessageType>>(null);
  const metricsRef = useRef({
    contentHeight: 0,
    viewportHeight: 0,
    scrollY: 0,
  });
  const followsEndRef = useRef(true);
  const followFrameRef = useRef<number | null>(null);
  const jumpRef = useRef<
    | {
        id: string;
        retried: boolean;
        timer: ReturnType<typeof setTimeout> | undefined;
      }
    | undefined
  >(undefined);
  const { Rail } = components;

  useEffect(() => () => {
    clearTimeout(jumpRef.current?.timer);
    if (followFrameRef.current !== null) cancelAnimationFrame(followFrameRef.current);
  }, []);
  useEffect(() => {
    followsEndRef.current = true;
    metricsRef.current = { ...metricsRef.current, contentHeight: 0, scrollY: 0 };
    if (followFrameRef.current !== null) cancelAnimationFrame(followFrameRef.current);
    followFrameRef.current = null;
  }, [conversationId]);

  const jumpTo = useCallback(
    (id: string) => {
      const index = aui.thread
        .getState()
        .messages.findIndex((message) => message.id === id);
      if (index === -1) return;
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
      });
    },
    [aui],
  );

  const scrollToMessage = useCallback(
    (id: string) => {
      clearTimeout(jumpRef.current?.timer);
      jumpRef.current = { id, retried: false, timer: undefined };
      jumpTo(id);
    },
    [jumpTo],
  );

  // The list cannot scroll to a row it has not laid out yet: an instant jump
  // to the estimated offset gets it rendering near the row, and one retry,
  // resolved by id again so a changed list cannot send it to another turn,
  // lands on the row itself.
  const onScrollToIndexFailed = useCallback(
    ({
      index,
      averageItemLength,
    }: {
      index: number;
      averageItemLength: number;
    }) => {
      listRef.current?.scrollToOffset({
        offset: index * averageItemLength,
        animated: false,
      });
      const jump = jumpRef.current;
      if (!jump || jump.retried) return;
      jump.retried = true;
      jump.timer = setTimeout(() => jumpTo(jump.id), SCROLL_RETRY_DELAY);
    },
    [jumpTo],
  );

  const publishDescent = useCallback(() => {
    const { contentHeight, viewportHeight, scrollY } = metricsRef.current;
    const remaining = contentHeight - viewportHeight - scrollY;
    const descent =
      viewportHeight > 0
        ? Math.round(
            Math.min(
              1,
              Math.max(0, (viewportHeight - remaining) / viewportHeight),
            ) * 100,
          ) / 100
        : 0;
    if (descent !== store.getSnapshot().descent) store.publish({ descent });
  }, [store]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: ViewabilityInfo) => {
      store.publish({
        visibleMessageIds: viewableItems.map((token) => token.item.id),
      });
    },
    [store],
  );

  const onListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      metricsRef.current = {
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
        scrollY: contentOffset.y,
      };
      publishDescent();
    },
    [publishDescent],
  );

  const onListContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const previousHeight = metricsRef.current.contentHeight;
      metricsRef.current.contentHeight = height;
      publishDescent();
      if (!followsKeyboard || !isRunning || !followsEndRef.current || previousHeight === 0 ||
          height <= previousHeight || metricsRef.current.viewportHeight === 0 ||
          followFrameRef.current !== null) return;
      // Coalesce content growth to one native scroll per frame. Only follow
      // while pinned; an intentional drag immediately cancels the request.
      followFrameRef.current = requestAnimationFrame(() => {
        followFrameRef.current = null;
        if (!followsEndRef.current) return;
        const { contentHeight, viewportHeight } = metricsRef.current;
        listRef.current?.scrollToOffset({
          offset: Math.max(0, contentHeight - viewportHeight),
          animated: true,
        });
      });
    },
    [followsKeyboard, isRunning, publishDescent],
  );

  const onManualScrollStart = useCallback(() => {
    followsEndRef.current = false;
    if (followFrameRef.current !== null) cancelAnimationFrame(followFrameRef.current);
    followFrameRef.current = null;
  }, []);
  const onManualScrollEnd = useCallback(() => {
    const { contentHeight, viewportHeight, scrollY } = metricsRef.current;
    followsEndRef.current = contentHeight - viewportHeight - scrollY <= 32;
  }, []);

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      const previousHeight = metricsRef.current.viewportHeight;
      metricsRef.current.viewportHeight = height;
      // Keep keyboard-driven resizes in lockstep with the composer; text-growth
      // following below is animated independently.
      if (followsKeyboard && isRunning && followsEndRef.current && previousHeight > 0 &&
          height !== previousHeight) {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, metricsRef.current.contentHeight - height),
          animated: false,
        });
      }
      const snapshot = store.getSnapshot();
      if (height !== snapshot.height || y !== snapshot.top) {
        store.publish({ height, top: y });
      }
      publishDescent();
    },
    [followsKeyboard, isRunning, publishDescent, store],
  );

  const viewport = useMemo(
    () => ({
      subscribe: store.subscribe,
      getSnapshot: store.getSnapshot,
      scrollToMessage,
    }),
    [store, scrollToMessage],
  );

  useEffect(() => {
    if (isRunning) {
      AccessibilityInfo.announceForAccessibility("Assistant is working");
    }
  }, [isRunning]);

  const measureViewport = () => {
    viewportRef.current?.measureInWindow((_x, y) => setViewportTop(y));
  };
  // Reserve the actual overlay height at the end of the list, not in its viewport.
  const measureComposerOverlay = (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setComposerOverlayHeight((current) =>
      current === height ? current : height,
    );
  };

  const threadViewport = (
    <View
      ref={followsKeyboard ? undefined : viewportRef}
      onLayout={followsKeyboard ? undefined : measureViewport}
      className="aui-thread-viewport mx-auto w-full max-w-[44rem] flex-1"
    >
      <AuiIf condition={(s) => isNewChatView(s) && !notice}>
        <View style={{ flex: 1, opacity: chromeRevealed ? 1 : 0 }}>
          {followsKeyboard ? (
            <IosWelcome />
          ) : (
            <View className="flex-1 justify-center">
              <WelcomeSlot />
            </View>
          )}
        </View>
      </AuiIf>
      <AuiIf condition={isHistoryLoadingView}>
        <View className="flex-1">
          <ThreadHistorySkeleton />
        </View>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.messages.length > 0 || !!notice}>
        {history?.isLoadingMore && <HistoryEdge />}
        <View className="relative flex-1">
          <ThreadPrimitive.MessagesFlatList
            // Viewability props cannot change once a FlatList is mounted.
            key={Rail ? "tracked" : "plain"}
            ref={listRef}
            autoScroll={!(followsKeyboard && isRunning)}
            {...(followsKeyboard ? {
              onScrollBeginDrag: onManualScrollStart,
              onScrollEndDrag: onManualScrollEnd,
              onMomentumScrollEnd: onManualScrollEnd,
            } : {})}
            className="aui-message-group flex-1"
            contentContainerClassName={cn(
              // 12px between turns; assistant internals use gap-2 (8px).
              "gap-3 px-4",
              !floatsComposer && "pt-4 pb-6",
              Rail && "pl-10",
            )}
            contentContainerStyle={
              floatsComposer
                ? {
                    // Rest under the transparent nav; scroll may fade behind it.
                    // 44 ≈ native stack bar height below the status bar inset.
                    paddingTop: contentPaddingTop ?? insets.top + 44 + 16,
                    // Resting messages clear the floating composer, but can scroll behind it.
                    paddingBottom: composerOverlayHeight + 24,
                  }
                : undefined
            }
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={notice ? <ThreadNotice {...notice} /> : undefined}
            {...(Rail || followsKeyboard ? {
              onContentSizeChange: onListContentSizeChange,
              onLayout: onListLayout,
              onScroll: onListScroll,
            } : {})}
            {...(Rail ? {
              onScrollToIndexFailed,
              onViewableItemsChanged,
              viewabilityConfig: MESSAGE_VIEWABILITY,
            } : {})}
            {...(history ? { history } : {})}
          >
            {() => <ThreadMessage />}
          </ThreadPrimitive.MessagesFlatList>
          {floatsComposer ? (
            <ThreadEdgeFades
              topHeight={48}
              bottomHeight={Math.max(48, Math.min(composerOverlayHeight, 140))}
            />
          ) : null}
        </View>
      </AuiIf>
      <View
        pointerEvents={
          !chromeRevealed ? "none" : floatsComposer ? "box-none" : undefined
        }
        className={floatsComposer ? "absolute inset-x-0 bottom-0" : undefined}
        onLayout={floatsComposer ? measureComposerOverlay : undefined}
        style={{
          opacity: chromeRevealed ? 1 : 0,
          overflow: "visible",
        }}
      >
        <ThreadFollowupSuggestions />
        <ComposerDock
          floats={floatsComposer}
          waitingAction={waitingAction}
          autoFocus={autoFocus && chromeRevealed && !signupBlocked}
          focusNewChatKey={chromeRevealed ? focusNewChatKey : -1}
          conversationId={conversationId}
        />
      </View>
      {Rail && (
        <View
          pointerEvents="box-none"
          className="aui-thread-rail absolute inset-0"
        >
          <Rail />
        </View>
      )}
    </View>
  );

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ComposerOwnsHitlContext.Provider value={waitingAction != null}>
        <ThreadViewportContext.Provider value={viewport}>
          <ThreadPrimitive.Root className="aui-root aui-thread-root bg-background flex-1">
            {followsKeyboard ? (
              <IosKeyboardLayout seedAtZero={conversationId == null}>
                {threadViewport}
              </IosKeyboardLayout>
            ) : (
              <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={viewportTop - insets.bottom}
              >
                {threadViewport}
              </KeyboardAvoidingView>
            )}
          </ThreadPrimitive.Root>
        </ThreadViewportContext.Provider>
      </ComposerOwnsHitlContext.Provider>
    </ThreadComponentsContext.Provider>
  );
};

/** Floating composer inset; lives under `IosKeyboardLayout` so it can track the keyboard. */
const ComposerDock: FC<{
  floats: boolean;
  waitingAction: ThreadProps["waitingAction"];
  autoFocus?: boolean;
  focusNewChatKey: number;
  conversationId?: string | null;
}> = ({
  floats,
  waitingAction,
  autoFocus,
  focusNewChatKey,
  conversationId,
}) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useContext(ComposerChromeContext);
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
      />
    </Animated.View>
  );
};

/** Hold full chrome through a native menu; menus do not report dismiss. */
const COMPOSER_MENU_HOLD_MS = 2500;
/** After blur, collapse sticky once menus have had a beat to open. */
const COMPOSER_BLUR_COLLAPSE_MS = 450;

/** One UI-thread keyboard height drives the iOS composer and transcript together. */
const IosKeyboardLayout: FC<{
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
  const widthProgress = useSharedValue(seedAtZero || !KeyboardController.isVisible() ? 0 : 1);
  const widthAnimating = useSharedValue(0);
  const stickyClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuHoldUntil = useRef(0);

  const setLiveActive = useCallback((active: boolean) => {
    liveActive.value = active ? 1 : 0;
  }, [liveActive]);

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
    [textExpanded, stickyExpanded, liveActive, keyboardDragging, widthProgress, pinExpanded, scheduleCollapse, collapseNow, setLiveActive],
  );

  useKeyboardHandler({
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
        widthProgress.value = composerKeyboardProgress(next, keyboardSpan.value);
      }
    },
    onInteractive: (event) => {
      "worklet";
      const next = Math.max(0, event.height);
      if (next + 1 < keyboardHeight.value) keyboardDragging.value = 1;
      keyboardHeight.value = next;
      widthAnimating.value = 0;
      widthProgress.value = composerKeyboardProgress(next, keyboardSpan.value);
      // Finger-drag dismiss collapses immediately and drops any menu hold.
      if (event.height < 40) runOnJS(collapseNow)();
    },
    onEnd: (event) => {
      "worklet";
      const next = Math.max(0, event.height);
      keyboardHeight.value = next;
      keyboardDragging.value = 0;
      widthProgress.value = composerKeyboardProgress(next, keyboardSpan.value);
      // Do not latch sticky from keyboard motion — that left chrome stuck
      // expanded after dismiss. Menus pin explicitly via pinExpanded.
    },
  }, [collapseNow, keyboardDragging, keyboardSpan, widthAnimating, widthProgress]);
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

const DefaultWelcome: FC = () => null;

const IosWelcome: FC = () => {
  const keyboardHeight = useContext(KeyboardHeightContext)!;
  const chromeApi = useContext(ComposerChromeContext);
  const dismissScrollY = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({
    // Fade any custom welcome content before the shrinking viewport moves it.
    opacity: interpolate(keyboardHeight.value, [0, 100], [1, 0], Extrapolation.CLAMP),
  }));
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissScrollY.value }],
    flex: 1,
    justifyContent: "center" as const,
  }));
  const onDismissScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      dismissScrollY.value = event.contentOffset.y;
    },
  });
  const onDismissScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!KeyboardController.isVisible()) return;
      const { contentOffset, velocity } = event.nativeEvent;
      if (contentOffset.y < -28 || (velocity?.y ?? 0) < -0.6) {
        chromeApi?.collapseNow();
        void KeyboardController.dismiss();
      }
    },
    [chromeApi],
  );
  // Empty new-chat has no message FlatList — this bounce scroll owns interactive
  // keyboard dismiss over the transcript area (composer has its own twin).
  return (
    <Animated.ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="always"
      alwaysBounceVertical
      bounces
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onDismissScroll}
      onScrollEndDrag={onDismissScrollEndDrag}
    >
      <Animated.View style={[pinStyle, fadeStyle]}>
        <WelcomeSlot />
      </Animated.View>
    </Animated.ScrollView>
  );
};

const WelcomeSlot: FC = () => {
  const { Welcome } = useContext(ThreadComponentsContext);
  const Component = Welcome ?? DefaultWelcome;
  return <Component />;
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const isSpoken = useAuiState((s) => s.message.metadata.modality === "voice");
  const { AssistantMessage: CustomAssistantMessage } = useContext(
    ThreadComponentsContext,
  );

  if (isEditing) return <EditComposer />;
  if (isSpoken) return <SpokenMessage />;
  if (role === "user") return <UserMessage />;
  const Assistant = CustomAssistantMessage ?? AssistantMessage;
  return <Assistant />;
};

type VoiceRunPosition = "single" | "start" | "middle" | "end";

const useVoiceRunPosition = (): VoiceRunPosition =>
  useAuiState((s) => {
    const before =
      s.thread.messages[s.message.index - 1]?.metadata.modality === "voice";
    const after =
      s.thread.messages[s.message.index + 1]?.metadata.modality === "voice";
    if (before) return after ? "middle" : "end";
    return after ? "start" : "single";
  });

const SpokenText: TextMessagePartComponent = ({ text }) => (
  <Text
    variant="secondary"
    className="aui-spoken-message-text leading-relaxed"
    selectable
    selectionColor="rgba(127, 127, 127, 0.35)"
  >
    {text}
  </Text>
);

const SpokenMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const position = useVoiceRunPosition();
  const isSpeaking = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status?.type === "running",
  );
  const opensExchange = position === "start" || position === "single";

  return (
    <MessagePrimitive.Root
      className={cn(
        "aui-spoken-message bg-muted/40 mx-2 px-3 py-1.5",
        `aui-spoken-message-${position}`,
        position === "single" && "rounded-xl py-2",
        position === "start" && "rounded-t-xl pt-2",
        position === "middle" && "-mt-6",
        position === "end" && "-mt-6 rounded-b-xl pb-2",
      )}
    >
      {opensExchange && (
        <View className="aui-spoken-exchange-header mb-1.5 flex-row items-center gap-1.5">
          <Icon as={PhoneIcon} className="text-muted-foreground size-3" />
          <Text variant="caption">Voice conversation</Text>
        </View>
      )}
      <View className="aui-spoken-message-content flex-row items-start gap-2">
        <View
          className="mt-1 shrink-0"
          accessible
          accessibilityLabel={role === "user" ? "You said" : "Assistant said"}
        >
          <Icon
            as={role === "user" ? MicIcon : AudioLinesIcon}
            className="text-muted-foreground size-3.5"
          />
        </View>
        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="min-w-0 flex-1">
            <MessagePrimitive.Parts components={{ Text: SpokenText }} />
            {isSpeaking && (
              <TypingIndicator
                variant="bare"
                announce={false}
                className="aui-spoken-message-indicator ms-1"
                accessibilityLabel="Assistant is speaking"
              />
            )}
          </View>
          <SpokenActionBar />
        </View>
      </View>
    </MessagePrimitive.Root>
  );
};

const SpokenActionBar: FC = () => (
  <AuiIf
    condition={(s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running")
    }
  >
    <View className="aui-spoken-action-bar flex-row gap-1">
      <ActionBarPrimitive.Copy
        copyToClipboard={copyToClipboard}
        className={iconButtonClassName}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Copy"
      >
        {({ isCopied }) => (
          <Icon
            as={isCopied ? CheckIcon : CopyIcon}
            className="text-muted-foreground size-3.5"
          />
        )}
      </ActionBarPrimitive.Copy>
    </View>
  </AuiIf>
);

// The edge sits above the list rather than inside it as a header: the list
// keeps its first visible row anchored, so a header inserted above that row
// would land outside the viewport instead of pushing into it.
const HistoryEdge: FC = () => {
  useAnnounce("Loading earlier messages");

  return (
    <View
      className="aui-thread-history-edge items-center pb-4"
      accessibilityLiveRegion={webLiveRegion}
    >
      <ShimmerLabel variant="secondary" tone="muted">
        Loading earlier messages
      </ShimmerLabel>
    </View>
  );
};

const ThreadHistorySkeleton: FC = () => (
  <View
    className="aui-thread-history-skeleton gap-6 px-4 pt-4"
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel="Loading conversation"
  >
    <View className="bg-muted ml-auto h-9 w-2/5 rounded-xl" />
    <View className="gap-2">
      <View className="bg-muted h-4 w-11/12 rounded" />
      <View className="bg-muted h-4 w-4/5 rounded" />
      <View className="bg-muted h-4 w-3/5 rounded" />
    </View>
    <View className="bg-muted ml-auto h-9 w-1/3 rounded-xl" />
    <View className="gap-2">
      <View className="bg-muted h-4 w-10/12 rounded" />
      <View className="bg-muted h-4 w-2/3 rounded" />
    </View>
  </View>
);

const ComposerInputHeightContext = createContext<SharedValue<number> | null>(null);

// The placeholder color is a class to prop mapping that reads the CSSOM, so it applies from the first render after hydration.
const DefaultComposerInput: FC<{ autoFocus?: boolean }> = ({
  autoFocus,
}) => {
  const hydrated = useHydrated();
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const expandedHeight = useContext(ComposerInputHeightContext);
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useContext(ComposerChromeContext);
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
  const placeholderColor = Platform.OS === "ios"
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
      paddingTop: interpolate(progress, [0, 1], [COMPOSER_COLLAPSED_INPUT_PAD_Y, 8]),
      paddingBottom: interpolate(progress, [0, 1], [COMPOSER_COLLAPSED_INPUT_PAD_Y, 4]),
    };
  });
  const scheme = useColorScheme();
  const placeholderInk = scheme === "dark" ? "rgba(235,235,245,0.62)" : "rgba(60,60,67,0.55)";
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
}> = ({
  autoFocus,
  focusNewChatKey,
  conversationId = null,
  waitingAction = null,
}) => {
  const { ComposerInput = DefaultComposerInput } = useContext(
    ThreadComponentsContext,
  );
  const keyboardHeight = useContext(KeyboardHeightContext);
  const keyboardSpan = useContext(KeyboardSpanContext);
  const chromeApi = useContext(ComposerChromeContext);
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
      paddingBottom: interpolate(progress, [0, 1], [6, 8]),
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
      marginTop: interpolate(progress, [0, 1], [0, 16]),
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
      height: interpolate(progress, [0, 1], [COMPOSER_MIN_INPUT, expandedHeight.value]),
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
            <View className="aui-composer-shell relative p-3" style={COMPOSER_SHELL_STYLE}>
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
              <Animated.View pointerEvents="none" style={inputSpacerStyle} />
              <Animated.View
                className="aui-composer-action-wrapper flex-row items-center"
                style={actionRowStyle}
              >
                <ComposerAddAttachment
                  preparing={preparingAttachment}
                  onPreparingChange={setPreparingAttachment}
                  conversationId={conversationId}
                />
                <ComposerRemoteAgentPicker disabled={preparingAttachment} />
                <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 8 }} />
                <ComposerTrailingControls
                  preparingAttachment={preparingAttachment}
                  onOpenLive={openLive}
                />
              </Animated.View>
              <Animated.View style={inputFrameStyle}>
                <ComposerInput key={focusNewChatKey} autoFocus={autoFocus} />
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
}> = ({ preparingAttachment, onOpenLive }) => {
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
        s.thread.voice !== undefined),
  );
  const isEmpty = useAuiState((s) => s.composer.isEmpty);
  const isIos = Platform.OS === "ios";

  return (
    <View className="flex-row items-center">
      <AuiIf
        condition={(s) =>
          s.composer.submission === undefined &&
          (!s.thread.isRunning || s.thread.voice !== undefined)
        }
      >
        {isEmpty ? (
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
        )}
      </AuiIf>
      <AuiIf
        condition={(s) =>
          s.composer.submission !== undefined ||
          (s.thread.isRunning && s.thread.voice === undefined)
        }
      >
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
      </AuiIf>
    </View>
  );
};

// Connection / send failures are explained via ThreadNotice + Resend — never
// as assistant chat copy (ErrorPrimitive / failure banners).

/**
 * Same renderer as assistant answers — iOS UITextView + Marked styles —
 * so bubble copy cannot drift to the TextInput default (~14pt).
 */
const UserText: TextMessagePartComponent = ({ text, status }) => (
  <View className="aui-user-message-text">
    <MarkdownText
      type="text"
      text={text}
      status={status ?? { type: "complete" }}
    />
  </View>
);

const ReasoningHidden = () => null;

type ContentPartComponents = {
  readonly Text: typeof AssistantInlineText;
  readonly Image: typeof Image;
  readonly File: typeof File;
  readonly Reasoning: typeof ReasoningHidden;
  readonly tools: { readonly Fallback: ToolCallMessagePartComponent };
};

function buildContentPartComponents(
  index: number,
  ToolFallbackComponent: ToolCallMessagePartComponent,
  TaskGroupComponent: ComponentType<{ group: ThreadGroupPart }>,
): ContentPartComponents {
  const Fallback: ToolCallMessagePartComponent = (props) => {
    if (props.toolName === "todo") return null;
    if (isTimelineToolCall(props)) return null;
    if (DELEGATION_TOOLS.has(props.toolName)) {
      const status = props.status ?? { type: "complete" as const };
      const group: ThreadGroupPart = {
        type: "group-task",
        indices: [index],
        status,
        counts: {
          running: status.type === "running" ? 1 : 0,
          complete: status.type === "complete" ? 1 : 0,
          incomplete: status.type === "incomplete" ? 1 : 0,
          requiresAction: status.type === "requires-action" ? 1 : 0,
        },
      };
      return <TaskGroupComponent group={group} />;
    }
    return <ToolFallbackComponent {...props} />;
  };

  return {
    Text: AssistantInlineText,
    Image,
    File,
    Reasoning: ReasoningHidden,
    tools: { Fallback },
  };
}

const AssistantMessage: FC = () => {
  const {
    ToolFallback: CustomToolFallback,
    TaskGroup: TaskGroupComponent = TaskGroup,
  } = useContext(ThreadComponentsContext);
  const ToolFallbackComponent = CustomToolFallback ?? ToolFallback;

  const motion = useMotion();
  const messageParts = useAuiState(
    (s) => s.message.parts,
  ) as readonly AssistantMessagePart[];
  const blocks = useMemo(
    () => splitAssistantBlocks(messageParts),
    [messageParts],
  );
  const lastTimeline = lastTimelineBlockIndex(blocks);
  const statusType = useAuiState((s) => s.message.status?.type);
  // Keep timeline live until the answer has painted a finished word — otherwise
  // chrome dies as soon as a text part mounts and the body is still blank.
  const answerHasPaintedWord = messageParts.some(
    (part) =>
      part.type === "text" &&
      typeof part.text === "string" &&
      (/\S+\s/.test(part.text) ||
        (statusType !== "running" && part.text.trim().length > 0)),
  );
  // Stable per-index maps so PartByIndex can bail out when only sibling
  // chrome re-renders. Rebuilt when the part list or tool renderers change.
  const componentsByIndex = useMemo(() => {
    const map = new Map<number, ContentPartComponents>();
    for (const block of blocks) {
      if (block.kind === "timeline") continue;
      for (const index of block.indices) {
        map.set(
          index,
          buildContentPartComponents(
            index,
            ToolFallbackComponent,
            TaskGroupComponent,
          ),
        );
      }
    }
    return map;
  }, [blocks, ToolFallbackComponent, TaskGroupComponent]);

  return (
    <MessagePrimitive.Root className="aui-assistant-message-root gap-2">
      <MessageFileToolClaims />
      {/* 8px stack: timeline meta → answer; sources join the footer with actions. */}
      <View className="aui-assistant-message-content gap-2">
        <TurnElapsedProvider>
          {/* Todos sit above interleaved content so the checklist stays
              visible while the agent works (parity with web placement). */}
          <SessionTodoList />
          {blocks.map((block, blockIndex) => {
            if (block.kind === "timeline") {
              return (
                <SessionTimelineSegment
                  key={`timeline-${block.indices[0] ?? blockIndex}`}
                  indices={block.indices}
                  isLast={blockIndex === lastTimeline}
                  live={
                    blockIndex === lastTimeline &&
                    (lastTimeline === blocks.length - 1 || !answerHasPaintedWord)
                  }
                />
              );
            }
            return (
              // No cluster enter here — messageEnter FadeInDown was painting the
              // whole answer as one rising block and masking streaming-text.
              <View
                key={`content-${block.indices[0] ?? blockIndex}`}
                className="gap-2"
              >
                {block.indices.map((index) => (
                  <MessagePrimitive.PartByIndex
                    key={index}
                    index={index}
                    components={componentsByIndex.get(index)}
                  />
                ))}
              </View>
            );
          })}
          <AssistantThinking />
        </TurnElapsedProvider>
      </View>
      <AssistantMessageFooter />
    </MessagePrimitive.Root>
  );
};

const AssistantMessageFooter: FC = () => {
  const motion = useMotion();
  const branchCount = useAuiState((s) => s.message.branchCount);
  const settled = useAuiState(
    (s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running"),
  );
  // Only enter-animate Sources/copy after an in-session settle — not when
  // opening a previous thread that already finished.
  const sawRunningRef = useRef(false);
  if (!settled) sawRunningRef.current = true;
  const enterFromLiveSettle = sawRunningRef.current && settled;
  if (branchCount <= 1 && !settled) return null;
  // Sources wait for settle and enter with copy/share (not mid-stream).
  if (!settled) {
    return (
      <View className="aui-assistant-message-footer flex-row items-center">
        <BranchPicker />
      </View>
    );
  }
  return (
    <Animated.View
      entering={motion && enterFromLiveSettle ? actionBarEnter : undefined}
      className="aui-assistant-message-footer gap-2"
    >
      <MessageSources />
      <View className="flex-row items-center">
        <BranchPicker />
        <AssistantActionBar />
      </View>
    </Animated.View>
  );
};

// Compact action glyphs (~16px) in a 28px visual button; hitSlop keeps ~44pt.
const assistantActionButtonClassName =
  "aui-assistant-action-button active:bg-muted size-7 items-center justify-center rounded-md";
const assistantActionHitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

const ShareMarkdown: FC = () => {
  const markdown = useAuiState((s) =>
    proseFromMessageText(
      s.message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n\n"),
    ),
  );
  if (Platform.OS === "web" || !markdown.trim()) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share response as Markdown"
      className={assistantActionButtonClassName}
      hitSlop={assistantActionHitSlop}
      onPress={() => void Share.share({ message: markdown, title: "Pearl response" }).catch(() => {})}
    >
      <Icon as={Share2Icon} className="text-muted-foreground size-4" />
    </Pressable>
  );
};

const AssistantActionBar: FC = () => (
  <View className="aui-assistant-action-bar-root flex-row gap-1">
    <ActionBarPrimitive.Copy
      copyToClipboard={copyToClipboard}
      className={assistantActionButtonClassName}
      hitSlop={assistantActionHitSlop}
      accessibilityLabel="Copy"
    >
      {({ isCopied }) => (
        <Icon
          as={isCopied ? CheckIcon : CopyIcon}
          className="text-muted-foreground size-4"
        />
      )}
    </ActionBarPrimitive.Copy>
    <ShareMarkdown />
  </View>
);

const UserMessage: FC = () => {
  const motion = useMotion();
  const branchCount = useAuiState((s) => s.message.branchCount);
  const threadRunning = useAuiState((s) => s.thread.isRunning);
  const isLast = useAuiState((s) => s.message.isLast);
  const internalMessage = useAuiState((s) =>
    s.message.role === "user" && s.message.parts.some((part) =>
      part.type === "text" && isTaskNotification(part.text ?? ""),
    ),
  );
  if (internalMessage) return null;
  // Enter only for a just-sent trailing user bubble during a live turn —
  // loading a previous thread must not FadeInDown every historical message.
  const enterFromLiveSend =
    motion && Platform.OS !== "web" && threadRunning && isLast;
  return (
    <Animated.View entering={enterFromLiveSend ? messageEnter : undefined}>
      <MessagePrimitive.Root
        className={cn(
          "aui-user-message-root items-end",
          branchCount > 1 && "gap-y-1.5",
        )}
      >
        <UserMessageAttachments />
        <View className="aui-user-message-content bg-muted max-w-[85%] rounded-2xl px-4 py-2.5">
          <MessagePrimitive.Parts components={{ Text: UserText, Image, File }} />
        </View>
        {branchCount > 1 ? (
          <View className="aui-user-message-footer flex-row items-center justify-end gap-2">
            <BranchPicker />
          </View>
        ) : null}
      </MessagePrimitive.Root>
    </Animated.View>
  );
};

const ThreadNotice: FC<NonNullable<ThreadProps["notice"]>> = ({ text, actionLabel, onAction }) => (
  <View className="border-border/60 bg-muted/40 mx-4 my-3 rounded-xl border p-3">
    <Text variant="secondary" accessibilityRole="alert">
      {text}
    </Text>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        className="mt-1 min-h-11 self-start justify-center"
      >
        <Text variant="secondary" weight="medium">
          {actionLabel}
        </Text>
      </Pressable>
    ) : null}
  </View>
);

const DefaultEditComposerInput: FC = () => (
  <ComposerPrimitive.Input
    className={cn(
      "aui-edit-composer-input web:resize-none web:outline-none min-h-14 px-4 pt-3 pb-1",
      textVariants({ variant: "body" }),
    )}
    multiline
    autoFocus
  />
);

const EditComposer: FC = () => {
  const { ComposerInput = DefaultEditComposerInput } = useContext(
    ThreadComponentsContext,
  );

  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper px-2">
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 bg-card ms-auto w-full max-w-[85%] rounded-3xl border">
        <ComposerInput />
        <View className="aui-edit-composer-footer mx-2.5 mb-2.5 flex-row items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel className="active:bg-accent h-8 justify-center rounded-full px-3.5">
            <Text variant="secondary" weight="medium">
              Cancel
            </Text>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send className="bg-primary active:bg-primary/90 h-8 justify-center rounded-full px-3.5">
            <Text
              variant="secondary"
              weight="medium"
              className="text-primary-foreground"
            >
              Update
            </Text>
          </ComposerPrimitive.Send>
        </View>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<ViewProps> = ({ className, ...rest }) => {
  const branchCount = useAuiState((s) => s.message.branchCount);
  if (branchCount <= 1) return null;

  return (
    <View
      className={cn(
        "aui-branch-picker-root -ms-2 me-2 flex-row items-center",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous
        className={cn(iconButtonClassName, "disabled:opacity-35")}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Previous"
      >
        <Icon as={ChevronLeftIcon} className="text-muted-foreground size-4" />
      </BranchPickerPrimitive.Previous>
      <Text
        variant="caption"
        weight="medium"
        className="aui-branch-picker-state"
      >
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </Text>
      <BranchPickerPrimitive.Next
        className={cn(iconButtonClassName, "disabled:opacity-35")}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Next"
      >
        <Icon as={ChevronRightIcon} className="text-muted-foreground size-4" />
      </BranchPickerPrimitive.Next>
    </View>
  );
};
