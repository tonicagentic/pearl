import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import {
  ComposerChromeContext,
  type ComposerChromeApi,
} from "@/components/assistant-ui/elements/composer-chrome";
import { ComposerModeModelPicker } from "@/components/mode-model-picker";
import {
  groupedIconButtonHitSlop,
  iconButtonClassName,
  iconButtonHitSlop,
} from "@/components/assistant-ui/elements/icon-button";
import { File } from "@/components/assistant-ui/elements/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import { AssistantInlineText } from "@/components/json-render/chat-json-render";
import { proseFromMessageText } from "../../../../lib/json-render/inline-spec";
import { SessionTimeline, TIMELINE_TOOLS } from "@/components/assistant-ui/elements/session-timeline";
import { SessionTodoList } from "@/components/assistant-ui/elements/todo-list";
import { TaskGroup, DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import { ToolGroup } from "@/components/assistant-ui/elements/tool-group";
import { AssistantThinking } from "@/components/assistant-ui/elements/assistant-thinking";
import { MessageSources } from "@/components/assistant-ui/elements/citation";
import {
  ShimmerLabel,
  inkButton,
  useAnnounce,
  useHydrated,
  useMotion,
  webLiveRegion,
} from "@/components/assistant-ui/elements/surfaces";
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
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ThreadMessage as ThreadMessageType,
  type ToolCallMessagePartComponent,
  type GroupByContext,
  groupPartByType,
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
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputInstance,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardController,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  components?: ThreadComponents | undefined;
  /** A windowed thread: the list asks for older messages when it reaches its start and shows the loading edge above them. */
  history?: ThreadHistory | undefined;
  /** Recovery belongs in the transcript, never in a bar that shifts the viewport. */
  notice?: { text: string; actionLabel?: string; onAction?: () => void } | null;
  /**
   * HITL pause above the composer: authorization banner, approval buttons,
   * choice-question buttons, or a free-text question field.
   */
  waitingAction?: WaitingAction | null;
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
const COMPOSER_SHELL_STYLE = {
  borderRadius: COMPOSER_SHELL_RADIUS,
  borderCurve: "continuous",
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
const iosComposerHitSlop = 6;

const lightComposerImpact = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
const KeyboardHeightContext = createContext<SharedValue<number> | null>(null);

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

/** 0 = minimized, 1 = expanded. Tracks interactive keyboard drag. */
function composerKeyboardProgress(keyboardHeight: number): number {
  "worklet";
  return interpolate(
    keyboardHeight,
    [0, COMPOSER_MORPH_RANGE],
    [0, 1],
    Extrapolation.CLAMP,
  );
}

/** Chrome morph: keyboard progress, held open while sticky after menus steal focus. */
function composerChromeProgress(
  keyboardHeight: number,
  stickyExpanded: number,
): number {
  "worklet";
  return Math.max(composerKeyboardProgress(keyboardHeight), stickyExpanded);
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
  components = EMPTY_COMPONENTS,
  history,
  notice,
  waitingAction,
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
              "gap-4 px-4",
              !floatsComposer && "pt-4 pb-6",
              Rail && "pl-10",
            )}
            contentContainerStyle={
              floatsComposer
                ? {
                    // Rest under the transparent nav; scroll may fade behind it.
                    // 44 ≈ native stack bar height below the status bar inset.
                    paddingTop: insets.top + 44 + 16,
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
        style={{ opacity: chromeRevealed ? 1 : 0 }}
      >
        <AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
          <View
            pointerEvents={floatsComposer ? "box-none" : undefined}
            className="px-4 pb-4"
          >
            <ThreadSuggestions />
          </View>
        </AuiIf>
        <ThreadFollowupSuggestions />
        <ComposerDock
          floats={floatsComposer}
          waitingAction={waitingAction}
          autoFocus={autoFocus && chromeRevealed}
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
      <ThreadViewportContext.Provider value={viewport}>
        <ThreadPrimitive.Root className="aui-root aui-thread-root bg-background flex-1">
          {followsKeyboard ? (
            <IosKeyboardLayout>{threadViewport}</IosKeyboardLayout>
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
}> = ({ floats, waitingAction, autoFocus, focusNewChatKey, conversationId }) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useContext(KeyboardHeightContext);
  const chromeApi = useContext(ComposerChromeContext);
  const safeBottom = insets.bottom;
  const minimizedBottom = Math.max(COMPOSER_MINIMIZED_BOTTOM_GAP, safeBottom - 8);
  // Side inset follows chrome (sticky keeps full width while menus are open);
  // bottom pad still tracks the real keyboard so the dock sits correctly.
  const dockStyle = useAnimatedStyle(() => {
    if (!floats) {
      return { paddingBottom: safeBottom + 8 };
    }
    const live = chromeApi?.liveActive.value ?? 0;
    if (live > 0.5) {
      // Call bar keeps the expanded floating inset with the keyboard dismissed.
      return {
        paddingHorizontal: COMPOSER_EDGE,
        paddingBottom: minimizedBottom,
      };
    }
    const lifted = keyboardHeight?.value ?? 0;
    const chrome = composerChromeProgress(
      lifted,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    const keyboardProgress = composerKeyboardProgress(lifted);
    const aboveKeyboard = COMPOSER_EDGE + Math.max(0, safeBottom - lifted);
    return {
      paddingHorizontal: interpolate(
        chrome,
        [0, 1],
        [COMPOSER_MINIMIZED_EDGE, COMPOSER_EDGE],
        Extrapolation.CLAMP,
      ),
      paddingBottom:
        minimizedBottom + (aboveKeyboard - minimizedBottom) * keyboardProgress,
    };
  });

  return (
    <Animated.View
      pointerEvents={floats ? "box-none" : undefined}
      className={
        floats ? "aui-thread-viewport-footer" : "aui-thread-viewport-footer px-4"
      }
      style={dockStyle}
    >
      {waitingAction ? <WaitingActionCard action={waitingAction} /> : null}
      <Composer
        autoFocus={autoFocus}
        focusNewChatKey={focusNewChatKey}
        conversationId={conversationId}
      />
    </Animated.View>
  );
};

/** Hold full chrome through a native menu; menus do not report dismiss. */
const COMPOSER_MENU_HOLD_MS = 2500;
/** After blur, collapse sticky once menus have had a beat to open. */
const COMPOSER_BLUR_COLLAPSE_MS = 450;

/** One UI-thread keyboard height drives the iOS composer and transcript together. */
const IosKeyboardLayout: FC<{ children: ReactNode }> = ({ children }) => {
  // A chat can mount while the keyboard is already open (e.g. after sign-in).
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  // Sticky is only for native menus stealing focus — keyboard height alone
  // drives the morph while the field is selected.
  const stickyExpanded = useSharedValue(0);
  const liveActive = useSharedValue(0);
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
      stickyExpanded,
      liveActive,
      pinExpanded,
      scheduleCollapse,
      collapseNow,
      setLiveActive,
    }),
    [stickyExpanded, liveActive, pinExpanded, scheduleCollapse, collapseNow, setLiveActive],
  );

  useKeyboardHandler({
    onStart: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onMove: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onInteractive: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
      // Finger-drag dismiss collapses immediately and drops any menu hold.
      if (event.height < 40) runOnJS(collapseNow)();
    },
    onEnd: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
      // Do not latch sticky from keyboard motion — that left chrome stuck
      // expanded after dismiss. Menus pin explicitly via pinExpanded.
    },
  }, [collapseNow]);
  const spacerStyle = useAnimatedStyle(() => ({
    // Tracks interactive drag; composer dock morphs against the same value.
    height: Math.max(0, keyboardHeight.value),
  }));

  return (
    <KeyboardHeightContext.Provider value={keyboardHeight}>
      <ComposerChromeContext.Provider value={chromeApi}>
        <View className="flex-1">
          {children}
          <Animated.View pointerEvents="none" style={spacerStyle} />
        </View>
      </ComposerChromeContext.Provider>
    </KeyboardHeightContext.Provider>
  );
};

const DefaultWelcome: FC = () => null;

const IosWelcome: FC = () => {
  const keyboardHeight = useContext(KeyboardHeightContext)!;
  const fadeStyle = useAnimatedStyle(() => ({
    // Fade any custom welcome content before the shrinking viewport moves it.
    opacity: interpolate(keyboardHeight.value, [0, 100], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[{ flex: 1, justifyContent: "center" }, fadeStyle]}>
      <WelcomeSlot />
    </Animated.View>
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
    className="aui-spoken-message-text text-foreground text-sm leading-relaxed"
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
          <Text className="text-muted-foreground text-xs">
            Voice conversation
          </Text>
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
      <ShimmerLabel className="text-muted-foreground text-[13px]">
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

const ThreadSuggestions: FC = () => (
  <View className="aui-thread-welcome-suggestions w-full flex-row flex-wrap items-center justify-center gap-2">
    <ThreadPrimitive.Suggestions>
      {() => <ThreadSuggestionItem />}
    </ThreadPrimitive.Suggestions>
  </View>
);

const ThreadSuggestionItem: FC = () => (
  <SuggestionPrimitive.Trigger
    send
    className="aui-thread-welcome-suggestion border-border/60 active:bg-muted flex-row items-center gap-1.5 rounded-full border px-3.5 py-1.5"
  >
    <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 text-foreground text-sm" />
    <AuiIf condition={(s) => !!s.suggestion.label}>
      <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-sm" />
    </AuiIf>
  </SuggestionPrimitive.Trigger>
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
  const chromeApi = useContext(ComposerChromeContext);
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
  const focusOnMount = useRef(autoFocus);
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
  const placeholderColor = Platform.OS === "ios"
    ? "accent-muted-foreground/85"
    : "accent-muted-foreground/60";
  // Vertical pad morphs with chrome: centered in the mini row, top-aligned when open.
  const iosPadStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    return {
      paddingTop: interpolate(progress, [0, 1], [COMPOSER_COLLAPSED_INPUT_PAD_Y, 8]),
      paddingBottom: interpolate(progress, [0, 1], [COMPOSER_COLLAPSED_INPUT_PAD_Y, 4]),
    };
  });
  const inputProps = {
    placeholder: "Ask anything",
    placeholderTextColorClassName: hydrated ? placeholderColor : undefined,
    className: cn(
      "aui-composer-input text-foreground web:resize-none web:outline-none",
      Platform.OS === "ios"
        ? "h-full w-full pl-2 pr-2 text-[17px] leading-[22px]"
        : "min-h-10 max-h-48 px-2.5 py-1 text-base leading-6",
    ),
    multiline: true,
    textAlignVertical: "top" as const,
    accessibilityLabel: "Message input",
  };

  useEffect(() => {
    if (Platform.OS !== "ios" || !focusOnMount.current) return;
    // The initial native autoFocus can select the field before the window is
    // ready, leaving a caret but no keyboard. Focus after it has mounted.
    const timer = setTimeout(() => nativeInput.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    return registerComposerInputFocus(() => {
      nativeInput.current?.focus();
    });
  }, []);

  return Platform.OS === "ios" ? (
    <AnimatedTextInput
      ref={nativeInput}
      value={value}
      style={iosPadStyle}
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
      }}
      onContentSizeChange={(event) => {
        if (!expandedHeight) return;
        // Match expanded pt-2 + pb-1 so the measured frame stays flush with the text.
        const next = Math.min(
          COMPOSER_EXPANDED_INPUT_MAX,
          Math.max(
            COMPOSER_EXPANDED_INPUT_MIN,
            Math.ceil(event.nativeEvent.contentSize.height) + 12,
          ),
        );
        if (expandedHeight.value !== next) expandedHeight.value = next;
      }}
      {...inputProps}
    />
  ) : (
    <ComposerPrimitive.Input autoFocus={autoFocus} {...inputProps} />
  );
};


const Composer: FC<{
  autoFocus?: boolean;
  focusNewChatKey: number;
  conversationId?: string | null;
}> = ({ autoFocus, focusNewChatKey, conversationId = null }) => {
  const { ComposerInput = DefaultComposerInput } = useContext(
    ThreadComponentsContext,
  );
  const keyboardHeight = useContext(KeyboardHeightContext);
  const chromeApi = useContext(ComposerChromeContext);
  // Start with a readable surface until the iOS accessibility setting is known.
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const [preparingAttachment, setPreparingAttachment] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const motion = useMotion();
  const pressed = useSharedValue(0);
  const shellWidth = useSharedValue(0);
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
      .catch(() => {}); // Keep the readable fallback if the setting cannot be read.
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
  const holdEnabled = Platform.OS === "ios" && motion;

  // Outer chrome pulses slightly while expanded; never transform the TextInput.
  const outerPressStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    const bump =
      holdEnabled && progress >= 0.5
        ? interpolate(pressed.value, [0, 1], [1, 1.02])
        : 1;
    return { transform: [{ scale: bump }] };
  });

  const shellStyle = useAnimatedStyle(() => {
    const progress =
      Platform.OS === "ios" && keyboardHeight
        ? composerChromeProgress(
            keyboardHeight.value,
            chromeApi?.stickyExpanded.value ?? 0,
          )
        : 1;
    // Collapsed hold shrink only — scaling the focused field dismisses the keyboard.
    const holdScale =
      holdEnabled && progress < 0.5
        ? interpolate(pressed.value, [0, 1], [1, 0.975])
        : 1;
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
    );
    return {
      height: interpolate(progress, [0, 1], [0, expandedHeight.value]),
    };
  });

  const actionRowStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    return {
      marginTop: interpolate(progress, [0, 1], [0, 16]),
      height: COMPOSER_MIN_INPUT,
      alignItems: "center" as const,
    };
  });

  const miniTrackStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    return {
      flexGrow: interpolate(progress, [0, 1], [1, 0]),
      flexBasis: interpolate(progress, [0, 1], [1, 0]),
      minWidth: interpolate(progress, [0, 1], [24, 0]),
      height: COMPOSER_MIN_INPUT,
      marginHorizontal: interpolate(progress, [0, 1], [COMPOSER_ROW_GAP, 0]),
    };
  });

  const modelStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    return {
      opacity: progress,
      maxWidth: interpolate(progress, [0, 1], [0, COMPOSER_CHIP]),
      marginLeft: interpolate(progress, [0, 1], [0, COMPOSER_ROW_GAP]),
      overflow: "hidden" as const,
    };
  });

  const endSpacerStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    return {
      flexGrow: interpolate(progress, [0, 1], [0, 1]),
      flexBasis: interpolate(progress, [0, 1], [0, 1]),
      minWidth: interpolate(progress, [0, 1], [0, 8]),
      height: 1,
    };
  });

  const inputFrameStyle = useAnimatedStyle(() => {
    const progress = composerChromeProgress(
      keyboardHeight?.value ?? 0,
      chromeApi?.stickyExpanded.value ?? 0,
    );
    // Positioned inside the in-flow stack (not the shell), so top:0 lines up
    // with the spacer/action row — avoids padding-box drift that left the
    // collapsed field sitting high in the pill.
    const contentWidth = Math.max(0, shellWidth.value - 16);
    const miniLeft = COMPOSER_CHIP + COMPOSER_ROW_GAP;
    const miniWidth = Math.max(
      0,
      contentWidth - COMPOSER_CHIP * 2 - COMPOSER_ROW_GAP * 2,
    );
    return {
      position: "absolute" as const,
      left: interpolate(progress, [0, 1], [miniLeft, 0]),
      width: interpolate(progress, [0, 1], [miniWidth, contentWidth]),
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

  const shellSurface = showGlass ? (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      style={GLASS_SURFACE_STYLE}
    />
  ) : (
    <View
      pointerEvents="none"
      className="border-border/60 dark:border-muted-foreground/15 bg-card absolute inset-0 border"
      style={COMPOSER_SHELL_STYLE}
    />
  );

  // Live call replaces the text composer inside the same glass shell. Skip the
  // keyboard morph so the call bar keeps a stable height with no keyboard up.
  if (liveOpen) {
    return (
      <ComposerPrimitive.Root className="aui-composer-root w-full">
        <View
          className="aui-composer-shell relative p-2"
          style={COMPOSER_SHELL_STYLE}
        >
          {shellSurface}
          <LiveSession onClose={closeLive} />
        </View>
      </ComposerPrimitive.Root>
    );
  }

  if (Platform.OS !== "ios") {
    return (
      <ComposerPrimitive.Root className="aui-composer-root w-full">
        <Animated.View
          className="aui-composer-shell relative gap-2 p-2"
          style={COMPOSER_SHELL_STYLE}
        >
          {shellSurface}
          <ComposerAttachments conversationId={conversationId} />
          <ComposerInput key={focusNewChatKey} autoFocus={autoFocus} />
          <View className="aui-composer-action-wrapper flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <ComposerAddAttachment
                preparing={preparingAttachment}
                onPreparingChange={setPreparingAttachment}
                conversationId={conversationId}
              />
              <ComposerModeModelPicker disabled={preparingAttachment} />
            </View>
            <ComposerTrailingControls
              preparingAttachment={preparingAttachment}
              onOpenLive={openLive}
            />
          </View>
        </Animated.View>
      </ComposerPrimitive.Root>
    );
  }

  // iOS morph: collapsed mini-player row ↔ full composer (input above, actions below).
  // One TextInput is absolutely positioned so keyboard drag never remounts it.
  return (
    <ComposerInputHeightContext.Provider value={expandedHeight}>
      <ComposerPrimitive.Root className="aui-composer-root w-full">
        <Animated.View style={outerPressStyle}>
          <Animated.View
            className="aui-composer-shell relative"
            style={[COMPOSER_SHELL_STYLE, shellStyle]}
            onLayout={(event) => {
              shellWidth.value = event.nativeEvent.layout.width;
            }}
            onTouchStart={holdEnabled ? beginHold : undefined}
            onTouchEnd={holdEnabled ? clearHold : undefined}
            onTouchCancel={holdEnabled ? clearHold : undefined}
          >
            {shellSurface}
            <ComposerAttachments conversationId={conversationId} />
            <View collapsable={false}>
              <Animated.View pointerEvents="none" style={inputSpacerStyle} />
              <Animated.View
                className="aui-composer-action-wrapper flex-row items-center"
                style={actionRowStyle}
                onTouchStart={() => {
                  // Hold full chrome only when the keyboard is up — pin while
                  // collapsed would expand the morph under attachment/model sheets.
                  if (KeyboardController.isVisible()) {
                    chromeApi?.pinExpanded();
                    focusComposerInput();
                  }
                }}
              >
                <ComposerAddAttachment
                  preparing={preparingAttachment}
                  onPreparingChange={setPreparingAttachment}
                  conversationId={conversationId}
                />
                <Animated.View pointerEvents="none" style={miniTrackStyle} />
                <Animated.View style={modelStyle} pointerEvents="box-none">
                  <ComposerModeModelPicker disabled={preparingAttachment} />
                </Animated.View>
                <Animated.View pointerEvents="none" style={endSpacerStyle} />
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
    </ComposerInputHeightContext.Provider>
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

const AssistantFailure: FC = () => {
  const failed = useAuiState((s) => s.message.status?.type === "incomplete" && s.message.status.reason === "error");
  if (!failed) return null;
  return (
    <Text
      className="text-destructive py-2 text-sm"
      accessibilityRole="alert"
      selectable
    >
      This response failed. Check the chat before sending again.
    </Text>
  );
};

const MessageError: FC = () => {
  // RN assistant-ui has no MessagePrimitive.Error; only render when this
  // message is a live incomplete failure (projection suppresses historical ones).
  const failed = useAuiState(
    (s) =>
      s.message.status?.type === "incomplete" &&
      s.message.status.reason === "error",
  );
  if (!failed) return null;
  return (
    <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-2xl bg-destructive/10 px-3.5 py-2.5">
      <ErrorPrimitive.Message
        className="aui-message-error-message text-destructive text-sm"
        selectable
      />
    </ErrorPrimitive.Root>
  );
};

const UserText: TextMessagePartComponent = ({ text }) => (
  <Text
    className="aui-user-message-text text-foreground text-[17px] leading-[26px]"
    selectable
    selectionColor="rgba(127, 127, 127, 0.35)"
  >
    {text}
  </Text>
);

const messageGroupBy = groupPartByType({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  "standalone-tool-call": [],
});

type ThreadGroupKey =
  | "group-chainOfThought"
  | "group-reasoning"
  | "group-tool"
  | "group-task";

const TASK_GROUP_PATH: readonly ThreadGroupKey[] = [
  "group-chainOfThought",
  "group-task",
];

const taskAwareGroupBy = (
  part: Parameters<typeof messageGroupBy>[0],
  context?: GroupByContext,
): readonly ThreadGroupKey[] => {
  const path = messageGroupBy(part, context);
  return part.type === "tool-call" &&
    part.messages !== undefined &&
    path.length > 0 &&
    !context?.toolUIs?.[part.toolName]?.length
    ? TASK_GROUP_PATH
    : path;
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: CustomToolFallback,
    TaskGroup: TaskGroupComponent = TaskGroup,
  } = useContext(ThreadComponentsContext);
  const ToolFallbackComponent = CustomToolFallback ?? ToolFallback;
  // Delegations group into task cards; everything else falls through to the
  // base grouping.
  const groupBy = taskAwareGroupBy;

  const messageParts = useAuiState((s) => s.message.parts);
  const isTimelineCovered = (index: number) => {
    const part = messageParts[index] as
      | { toolName?: string; type?: string; status?: { type: string } }
      | undefined;
    return (
      part?.type === "reasoning" ||
      (part?.status?.type !== "requires-action" && part?.toolName !== "write_file" && (part?.toolName === "todo" || TIMELINE_TOOLS.has(part?.toolName ?? "")))
    );
  };

  return (
    <MessagePrimitive.Root className="aui-assistant-message-root">
      <View className="aui-assistant-message-content gap-2">
        <AssistantThinking />
        <SessionTimeline />
        <SessionTodoList />
        <MessageError />
        <AssistantFailure />
        <MessagePrimitive.GroupedParts groupBy={groupBy}>
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                // Reasoning and timeline-covered tool steps render nothing
                // here; a chain only shows children when it holds something
                // the timeline does not summarize (a delegated task card).
                if (part.indices.every(isTimelineCovered)) return null;
                return children;
              case "group-tool": {
                if (part.indices.every(isTimelineCovered)) {
                  // Every tool in the group is summarized by the timeline.
                  return null;
                }
                const groupParts = part.indices.map(
                  (index) => messageParts[index],
                );
                const isDelegationGroup =
                  groupParts.length > 0 &&
                  groupParts.every(
                    (groupPart) =>
                      groupPart?.type === "tool-call" &&
                      DELEGATION_TOOLS.has(groupPart.toolName),
                  );
                if (isDelegationGroup) {
                  // Delegated tasks render as task cards (docs:
                  // elements/task-card) instead of the tool group.
                  if (TaskGroupComponent) return <TaskGroupComponent group={part} />;
                  return null;
                }
                const toolParts = groupParts.filter(
                  (
                    groupPart,
                  ): groupPart is Extract<
                    (typeof groupParts)[number],
                    { type: "tool-call" }
                  > => groupPart?.type === "tool-call",
                );
                const needsApproval = toolParts.some(
                  (groupPart) => groupPart.status?.type === "requires-action",
                );
                const approved = toolParts.some(
                  (groupPart) => groupPart.approval?.approved === true,
                );
                const denied = toolParts.some(
                  (groupPart) =>
                    groupPart.approval?.approved === false ||
                    groupPart.approval?.resolution === "cancelled" ||
                    groupPart.approval?.resolution === "expired",
                );
                const statusHint = needsApproval
                  ? "Waiting"
                  : denied
                    ? "Cancelled"
                    : approved
                      ? "Approved"
                      : undefined;
                // A solo tool (common for approvals) should name itself instead
                // of reading as the generic "1 tool call".
                const toolName =
                  toolParts.length === 1 ? toolParts[0]?.toolName : undefined;
                return (
                  <ToolGroup
                    count={part.indices.length}
                    toolName={toolName}
                    active={part.status.type === "running"}
                    defaultOpen={needsApproval}
                    statusHint={statusHint}
                  >
                    {children}
                  </ToolGroup>
                );
              }
              case "group-task":
                return TaskGroupComponent ? (
                  <TaskGroupComponent group={part} />
                ) : null;
              case "group-reasoning":
                // Reasoning is summarized by the timeline.
                return null;
              case "text":
                return <AssistantInlineText />;
              case "image":
                return <Image {...part} />;
              case "file":
                return <File {...part} />;
              case "reasoning":
                // Summarized by the timeline.
                return null;
              case "tool-call":
                if (part.toolName === "todo") return null;
                if (TIMELINE_TOOLS.has(part.toolName) && part.status.type !== "requires-action" && part.toolName !== "write_file") {
                  // Summarized by the timeline above.
                  return null;
                }
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data":
                return part.dataRendererUI;
              case "indicator":
                // AssistantThinking above owns the pre-content state.
                return null;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageSources />
        <MessageError />
      </View>
      <View className="aui-assistant-message-footer min-h-7 flex-row items-center pt-1.5">
        <BranchPicker />
        <AssistantActionBar />
      </View>
    </MessagePrimitive.Root>
  );
};

// Compact action glyphs (~20px) in a 32px visual button; hitSlop keeps ~44pt.
const assistantActionButtonClassName =
  "aui-assistant-action-button active:bg-muted size-8 items-center justify-center rounded-md";
const assistantActionHitSlop = { top: 6, bottom: 6, left: 6, right: 6 };

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
      <Icon as={Share2Icon} className="text-muted-foreground size-5" />
    </Pressable>
  );
};

const AssistantActionBar: FC = () => (
  <AuiIf
    condition={(s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running")
    }
  >
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
            className="text-muted-foreground size-5"
          />
        )}
      </ActionBarPrimitive.Copy>
      <ShareMarkdown />
    </View>
  </AuiIf>
);

const UserSendState: FC = () => {
  const phase = useAuiState((s) => s.message.metadata?.custom?.mobileSendState);
  // Preparing is silent: the pending assistant Thinking row covers that beat.
  if (phase !== "uncertain") return null;
  return (
    <Text
      className="text-muted-foreground text-xs"
      accessibilityRole="alert"
    >
      Delivery not confirmed. Check before resending.
    </Text>
  );
};

const UserMessage: FC = () => {
  const motion = useMotion();
  const internalMessage = useAuiState((s) =>
    s.message.role === "user" && s.message.parts.some((part) =>
      part.type === "text" && isTaskNotification(part.text ?? ""),
    ),
  );
  if (internalMessage) return null;
  return (
    <Animated.View
      entering={
        motion
          ? FadeInDown.springify(220).damping(28).stiffness(280).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 14 }],
            })
          : undefined
      }
    >
      <MessagePrimitive.Root className="aui-user-message-root items-end gap-y-1.5">
        <UserMessageAttachments />
        <View className="aui-user-message-content bg-card max-w-[85%] rounded-2xl px-4 py-2.5">
          <MessagePrimitive.Parts components={{ Text: UserText, Image, File }} />
        </View>
        <View className="aui-user-message-footer flex-row items-center justify-end gap-2">
          <UserSendState />
          <BranchPicker />
        </View>
      </MessagePrimitive.Root>
    </Animated.View>
  );
};

const ThreadNotice: FC<NonNullable<ThreadProps["notice"]>> = ({ text, actionLabel, onAction }) => (
  <View className="border-border/60 bg-muted/40 mx-4 my-3 rounded-xl border p-3">
    <Text className="text-foreground text-sm" accessibilityRole="alert">{text}</Text>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        className="mt-1 min-h-11 self-start justify-center"
      >
        <Text className="text-foreground text-sm font-medium">{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const DefaultEditComposerInput: FC = () => (
  <ComposerPrimitive.Input
    className="aui-edit-composer-input text-foreground web:resize-none web:outline-none min-h-14 px-4 pt-3 pb-1 text-base"
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
            <Text className="text-foreground text-sm font-medium">Cancel</Text>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send className="bg-primary active:bg-primary/90 h-8 justify-center rounded-full px-3.5">
            <Text className="text-primary-foreground text-sm font-medium">
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
      <Text className="aui-branch-picker-state text-muted-foreground text-xs font-medium">
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
