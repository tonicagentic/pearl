import { UserMessageAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { ComposerChromeContext } from "@/components/assistant-ui/elements/composer-chrome";
import {
  COMPOSER_EDGE,
  LIQUID_GLASS_SHADOW_DARK,
  LIQUID_GLASS_SHADOW_LIGHT,
} from "@/components/assistant-ui/elements/composer-morph";
import { ComposerOwnsHitlContext } from "@/components/assistant-ui/elements/composer-owns-hitl";
import {
  groupedIconButtonHitSlop,
  iconButtonClassName,
} from "@/components/assistant-ui/elements/icon-button";
import { LiquidGlassShell } from "@/components/ui/liquid-glass";
import { usePearlCardBackground } from "@/src/navigation-theme";
import { useCSSVariable } from "uniwind";
import { File } from "@/components/assistant-ui/elements/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { ThreadSuggestedPrompts } from "@/components/assistant-ui/elements/suggested-prompts.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import {
  IosKeyboardLayout,
  KeyboardHeightContext,
} from "@/components/assistant-ui/elements/ios-keyboard-layout.aui";
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
  QuoteSelectionProvider,
  SaveQuoteAction,
  SelectionBookmarkBridge,
} from "@/components/assistant-ui/elements/quote-selection";
import {
  ShimmerLabel,
  actionBarEnter,
  inkButton,
  messageEnter,
  monoStyle,
  useAnnounce,
  useMotion,
  webLiveRegion,
} from "@/components/assistant-ui/elements/surfaces";
import { MessageFileToolClaims } from "@/components/assistant-ui/elements/file-tool-claim";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback";
import { TypingIndicator } from "@/components/assistant-ui/elements/typing-indicator";
import { ThreadEdgeFades } from "@/components/assistant-ui/elements/thread-edge-fades";
import { ComposerDock } from "@/components/assistant-ui/elements/thread-composer.aui";
import {
  EMPTY_THREAD_COMPONENTS,
  ThreadComponentsContext,
  type ThreadComponents,
  type ThreadGroupPart,
} from "@/components/assistant-ui/elements/thread-components-context";
import { type WaitingAction } from "@/components/assistant-ui/elements/waiting-action-card";
import { ConnectionState } from "@/components/assistant-ui/elements/connection-state";
import { ErrorState } from "@/components/assistant-ui/elements/error-state";
import {
  formatMessageDay,
  formatMessageTime,
  shouldShowDaySeparator,
} from "../../../../lib/chat/message-day";
import { isTaskNotification } from "@/src/message-projection";
import type { ThreadFooterNotice } from "@/src/chat/thread-notice";
import { useActiveChat } from "@/src/chat-context";
import {
  getPendingSeedMessage,
  subscribePendingSeedMessage,
  takePendingSeedMessage,
} from "@/src/pending-seed-message";
import { takePendingQuoteScroll } from "@/src/pending-quote-scroll";
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
  ArrowDownIcon,
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
  useColorScheme,
  View,
  type ViewProps,
} from "react-native";
import { Text, textVariants } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardController } from "@/src/keyboard-controller";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

export type {
  ThreadComponents,
  ThreadGroupPart,
} from "@/components/assistant-ui/elements/thread-components-context";

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
  notice?: ThreadFooterNotice | null;
  /**
   * HITL pause that morphs the composer shell into the response surface:
   * authorization banner, approval buttons, choice options, or free-text.
   */
  waitingAction?: WaitingAction | null;
  /** Guest hit the free-message limit — don't steal focus into the composer. */
  signupBlocked?: boolean | undefined;
};

/** Distance from the end that counts as “pinned” for follow + the FAB. */
const NEAR_BOTTOM_PX = 32;
/** Visual size of the scroll-to-bottom glass control. */
const SCROLL_TO_BOTTOM_SIZE = 34;

export type ThreadViewportSnapshot = {
  /** The ids of the messages on screen, in list order. */
  readonly visibleMessageIds: readonly string[];
  /**
   * Zero until the list is within one screenful of its end, then the share of
   * that stretch scrolled, so a reading line placed at this fraction of the
   * viewport can still reach the final turns.
   */
  readonly descent: number;
  /** True when the list is within NEAR_BOTTOM_PX of its end. */
  readonly nearBottom: boolean;
  /** The message list's height. */
  readonly height: number;
  /** The message list's offset from the top of the thread viewport, which grows while the history edge shows. */
  readonly top: number;
};

export type ThreadViewport = ThreadViewportSnapshot & {
  /** Scrolls the message list until the message starts at the top of the viewport. */
  readonly scrollToMessage: (id: string) => void;
  /** Scrolls to the latest messages and re-pins follow-while-streaming. */
  readonly scrollToBottom: () => void;
};

type ThreadViewportStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => ThreadViewportSnapshot;
  readonly scrollToMessage: (id: string) => void;
  readonly scrollToBottom: () => void;
};

const EMPTY_IDS: readonly string[] = [];
const IDLE_VIEWPORT: ThreadViewportSnapshot = {
  visibleMessageIds: EMPTY_IDS,
  descent: 0,
  nearBottom: true,
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
const ThreadViewportContext = createContext<ThreadViewportStore>({
  subscribe: () => () => {},
  getSnapshot: () => IDLE_VIEWPORT,
  scrollToMessage: () => {},
  scrollToBottom: () => {},
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
  const { subscribe, getSnapshot, scrollToMessage, scrollToBottom } = useContext(
    ThreadViewportContext,
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({ ...snapshot, scrollToMessage, scrollToBottom }),
    [snapshot, scrollToBottom, scrollToMessage],
  );
};

const copyToClipboard = async (text: string) => {
  await Clipboard.setStringAsync(text);
};

/**
 * Goals (and similar) queue a first message before navigating to Pearl.
 * Send it once the empty composer is ready.
 *
 * Take the seed only when actually sending — clearing it in the effect body
 * lost the message when `newChat()` swapped the store and re-ran this effect
 * before the timeout fired.
 */
const SeedMessageBridge: FC = () => {
  const aui = useAui();
  const { newChatEntry, activeChatId } = useActiveChat();
  const messageCount = useAuiState((s) => s.thread.messages.length);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const seed = useSyncExternalStore(
    subscribePendingSeedMessage,
    getPendingSeedMessage,
    getPendingSeedMessage,
  );

  useEffect(() => {
    if (!seed) return;
    // Only fire on a brand-new empty Pearl thread.
    if (activeChatId != null) return;
    if (messageCount > 0 || isRunning) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const text = takePendingSeedMessage();
      if (!text) return;
      aui.composer.setText(text);
      aui.composer.send();
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [seed, newChatEntry, activeChatId, messageCount, isRunning, aui]);

  return null;
};

/**
 * Library "Open chat" sets a pending message id; scroll once the transcript
 * for that chat is mounted.
 */
const QuoteScrollBridge: FC = () => {
  const { activeChatId } = useActiveChat();
  const { scrollToMessage } = useThreadViewport();
  const aui = useAui();
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeChatId) return;
    const messageId = takePendingQuoteScroll(activeChatId);
    if (!messageId) return;
    if (attemptedRef.current === messageId) return;
    attemptedRef.current = messageId;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryScroll = () => {
      const index = aui.thread
        .getState()
        .messages.findIndex((message) => message.id === messageId);
      if (index !== -1) {
        scrollToMessage(messageId);
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        timer = setTimeout(tryScroll, 100);
      }
    };

    timer = setTimeout(tryScroll, 50);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeChatId, aui, scrollToMessage]);

  return null;
};

/**
 * Small liquid-glass jump control above the composer. Absolute so it does not
 * change overlay height; unmounts when near the bottom (never opacity-hide glass).
 */
const ThreadScrollToBottom: FC = () => {
  const { nearBottom, scrollToBottom } = useThreadViewport();
  const cardColor = usePearlCardBackground();
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  const scheme = useColorScheme();
  const glassShadow =
    scheme === "dark" ? LIQUID_GLASS_SHADOW_DARK : LIQUID_GLASS_SHADOW_LIGHT;

  if (nearBottom) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 z-10 items-center"
      style={{ top: -(SCROLL_TO_BOTTOM_SIZE + 10) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scroll to bottom"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          scrollToBottom();
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }}
        style={[
          glassShadow,
          {
            width: SCROLL_TO_BOTTOM_SIZE,
            height: SCROLL_TO_BOTTOM_SIZE,
            borderRadius: SCROLL_TO_BOTTOM_SIZE / 2,
          },
        ]}
      >
        <LiquidGlassShell
          interactive
          fallbackColor={cardColor}
          style={{
            width: SCROLL_TO_BOTTOM_SIZE,
            height: SCROLL_TO_BOTTOM_SIZE,
            borderRadius: SCROLL_TO_BOTTOM_SIZE / 2,
          }}
          contentStyle={{
            width: SCROLL_TO_BOTTOM_SIZE,
            height: SCROLL_TO_BOTTOM_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            as={ArrowDownIcon}
            size={16}
            color={foreground ?? "#0d0d0d"}
          />
        </LiquidGlassShell>
      </Pressable>
    </View>
  );
};

export { WaitingActionCard } from "@/components/assistant-ui/elements/waiting-action-card";

export const Thread: FC<ThreadProps> = ({
  autoFocus = true,
  conversationId,
  focusNewChatKey = 0,
  chromeRevealed = true,
  contentPaddingTop,
  components = EMPTY_THREAD_COMPONENTS,
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
    store.publish({ nearBottom: true, descent: 1 });
  }, [conversationId, store]);

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

  const scrollToBottom = useCallback(() => {
    const { contentHeight, viewportHeight } = metricsRef.current;
    followsEndRef.current = true;
    listRef.current?.scrollToOffset({
      offset: Math.max(0, contentHeight - viewportHeight),
      animated: true,
    });
    store.publish({ nearBottom: true, descent: 1 });
  }, [store]);

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
    const nearBottom =
      viewportHeight <= 0 || contentHeight <= viewportHeight
        ? true
        : remaining <= NEAR_BOTTOM_PX;
    const descent =
      viewportHeight > 0
        ? Math.round(
            Math.min(
              1,
              Math.max(0, (viewportHeight - remaining) / viewportHeight),
            ) * 100,
          ) / 100
        : 0;
    const snapshot = store.getSnapshot();
    if (descent !== snapshot.descent || nearBottom !== snapshot.nearBottom) {
      store.publish({ descent, nearBottom });
    }
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
    followsEndRef.current =
      contentHeight - viewportHeight - scrollY <= NEAR_BOTTOM_PX;
    publishDescent();
  }, [publishDescent]);

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
      scrollToBottom,
    }),
    [store, scrollToBottom, scrollToMessage],
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
            onContentSizeChange={onListContentSizeChange}
            onLayout={onListLayout}
            onScroll={onListScroll}
            scrollEventThrottle={16}
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
      {/*
        Never opacity-hide this subtree. GlassView / liquid glass ancestors that
        hit ~0 alpha skip the UIKit effect forever (expo-glass-effect docs).
        During auth handoff, keep the dock unmounted instead of alpha=0.
      */}
      {chromeRevealed ? (
        <View
          pointerEvents={floatsComposer ? "box-none" : undefined}
          className={floatsComposer ? "absolute inset-x-0 bottom-0" : undefined}
          onLayout={floatsComposer ? measureComposerOverlay : undefined}
          style={{ overflow: "visible" }}
        >
          <ThreadFollowupSuggestions />
          <ThreadSuggestedPrompts />
          <View className="relative" pointerEvents="box-none">
            <ThreadScrollToBottom />
            <ComposerDock
              floats={floatsComposer}
              waitingAction={waitingAction}
              autoFocus={autoFocus && !signupBlocked}
              focusNewChatKey={focusNewChatKey}
              conversationId={conversationId}
            />
          </View>
        </View>
      ) : null}
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
          <SelectionBookmarkBridge />
          <SeedMessageBridge />
          <QuoteScrollBridge />
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

function isHiddenThreadMessage(message: {
  readonly role: string;
  readonly parts?: readonly { readonly type: string; readonly text?: string }[];
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
}): boolean {
  if (message.role !== "user") return false;
  const parts = message.parts ?? message.content ?? [];
  return parts.some(
    (part) =>
      part.type === "text" && isTaskNotification(part.text ?? ""),
  );
}

const MessageDayRule: FC = () => {
  const label = useAuiState((s) => {
    if (isHiddenThreadMessage(s.message)) return null;
    const current = s.message.createdAt;
    let previous: Date | undefined;
    for (let i = s.message.index - 1; i >= 0; i -= 1) {
      const earlier = s.thread.messages[i];
      if (!earlier || isHiddenThreadMessage(earlier)) continue;
      previous = earlier.createdAt;
      break;
    }
    if (!shouldShowDaySeparator(current, previous)) return null;
    // Day rule carries the clock — user bubbles stay clean.
    return `${formatMessageDay(current)} · ${formatMessageTime(current)}`;
  });
  if (!label) return null;
  return (
    <View
      accessibilityRole="header"
      className="aui-message-day-rule my-1 flex-row items-center gap-2.5 py-1"
    >
      <View className="bg-foreground/10 h-px flex-1" />
      <Text
        variant="caption"
        className="text-muted-foreground"
        style={monoStyle}
      >
        {label}
      </Text>
      <View className="bg-foreground/10 h-px flex-1" />
    </View>
  );
};

const MessageTime: FC<{ className?: string }> = ({ className }) => {
  const time = useAuiState((s) => {
    if (isHiddenThreadMessage(s.message)) return null;
    const at = s.message.createdAt;
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) return null;
    return formatMessageTime(at);
  });
  if (!time) return null;
  return (
    <Text
      variant="caption"
      className={cn("text-muted-foreground/50 shrink-0 tabular-nums", className)}
      style={monoStyle}
    >
      {time}
    </Text>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const isSpoken = useAuiState((s) => s.message.metadata.modality === "voice");
  const { AssistantMessage: CustomAssistantMessage } = useContext(
    ThreadComponentsContext,
  );
  const Assistant = CustomAssistantMessage ?? AssistantMessage;

  let body: ReactNode;
  if (isEditing) body = <EditComposer />;
  else if (isSpoken) body = <SpokenMessage />;
  else if (role === "user") body = <UserMessage />;
  else body = <Assistant />;

  return (
    <>
      <MessageDayRule />
      {body}
    </>
  );
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
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
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
          {role === "assistant" ? <MessageTime /> : null}
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

// Connection / send failures are explained via ThreadNotice + Resend — never
// as assistant chat copy (ErrorPrimitive / failure banners).

/**
 * Detect structured markdown so plain user lines can hug Text width instead
 * of expanding through the iOS TextInput Marked path.
 */
function userTextHasMarkdown(text: string): boolean {
  return (
    /```/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /\*\*[^*\n]+\*\*/.test(text) ||
    /__[^_\n]+__/.test(text) ||
    /\[[^\]]+\]\([^)\s]+\)/.test(text) ||
    /!\[[^\]]*\]\([^)\s]+\)/.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /^>\s/m.test(text) ||
    /^[-*+]\s+\S/m.test(text) ||
    /^\d+\.\s+\S/m.test(text)
  );
}

/**
 * Plain user copy uses label Text so the bubble shrinks to the longest line
 * (capped by the shell's max-w). Markdown keeps the shared Marked renderer.
 */
const UserText: TextMessagePartComponent = ({ text, status }) => {
  if (userTextHasMarkdown(text)) {
    return (
      <View className="aui-user-message-text">
        <MarkdownText
          type="text"
          text={text}
          status={status ?? { type: "complete" }}
        />
      </View>
    );
  }
  return (
    <Text
      variant="label"
      className="aui-user-message-text"
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        void copyToClipboard(text);
      }}
    >
      {text}
    </Text>
  );
};

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
      <QuoteSelectionProvider>
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
      </QuoteSelectionProvider>
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
  if (branchCount <= 1 && !settled) {
    return (
      <View className="aui-assistant-message-footer flex-row items-center">
        <MessageTime />
      </View>
    );
  }
  // Sources wait for settle and enter with copy/share (not mid-stream).
  if (!settled) {
    return (
      <View className="aui-assistant-message-footer flex-row items-center gap-2">
        <MessageTime />
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
      <View className="flex-row items-center gap-2">
        <MessageTime />
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

const AssistantActionBar: FC = () => {
  const markdown = useAuiState((s) =>
    proseFromMessageText(
      s.message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n\n"),
    ),
  );
  return (
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
      <SaveQuoteAction markdown={markdown} />
      <ShareMarkdown />
    </View>
  );
};

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
        <View className="aui-user-message-content bg-muted max-w-[85%] min-w-0 shrink rounded-2xl px-4 py-2">
          <MessagePrimitive.Parts
            components={{ Text: UserText, Image, File }}
          />
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

const ThreadNotice: FC<NonNullable<ThreadProps["notice"]>> = (notice) => {
  if (notice.kind === "connection") {
    return (
      <ConnectionState
        phase={notice.phase}
        attempt={notice.attempt}
        message={notice.message}
        onRetry={notice.onRetry}
        onResumedClear={notice.onResumedClear}
      />
    );
  }
  if (notice.kind === "error") {
    return (
      <ErrorState
        title={notice.title}
        detail={notice.detail}
        retrying={Boolean(notice.retrying)}
        actionLabel={notice.actionLabel}
        onRetry={notice.onRetry}
      />
    );
  }
  return (
    <View className="border-border/60 bg-muted/40 mx-4 my-3 rounded-xl border p-3">
      <Text variant="secondary" accessibilityRole="alert">
        {notice.text}
      </Text>
    </View>
  );
};

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
