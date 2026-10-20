import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { ComposerModelPicker } from "@/components/model-picker";
import {
  groupedIconButtonHitSlop,
  iconButtonClassName,
  iconButtonHitSlop,
} from "@/components/assistant-ui/elements/icon-button";
import { File } from "@/components/assistant-ui/elements/file";
import { Image } from "@/components/assistant-ui/elements/image";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { SessionTimeline, TIMELINE_TOOLS } from "@/components/assistant-ui/elements/session-timeline";
import { TaskGroup, DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import { ToolGroup } from "@/components/assistant-ui/elements/tool-group";
import {
  ShimmerLabel,
  useAnnounce,
  useHydrated,
  webLiveRegion,
} from "@/components/assistant-ui/elements/surfaces";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback";
import { TypingIndicator } from "@/components/assistant-ui/elements/typing-indicator";
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
  Text,
  TextInput,
  View,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardController, useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

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
  /** Remount only the input when entering a new chat, not on every render. */
  focusNewChatKey?: number | undefined;
  components?: ThreadComponents | undefined;
  /** A windowed thread: the list asks for older messages when it reaches its start and shows the loading edge above them. */
  history?: ThreadHistory | undefined;
  /** Recovery belongs in the transcript, never in a bar that shifts the viewport. */
  notice?: { text: string; actionLabel?: string; onAction?: () => void } | null;
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
const GLASS_SURFACE_STYLE = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  borderRadius: 24,
} as const;
const KeyboardHeightContext = createContext<SharedValue<number> | null>(null);

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

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

export const Thread: FC<ThreadProps> = ({
  autoFocus = true,
  focusNewChatKey = 0,
  components = EMPTY_COMPONENTS,
  history,
  notice,
}) => {
  const aui = useAui();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const insets = useSafeAreaInsets();
  const followsKeyboard = Platform.OS === "ios" && !Platform.isPad;
  const floatsComposer = Platform.OS === "ios";
  // Only bottom-docked iPhone keyboards use the spacer; keep other layouts unchanged.
  const viewportRef = useRef<ComponentRef<typeof View>>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [composerOverlayHeight, setComposerOverlayHeight] = useState(insets.bottom + 116);
  const [store] = useState(createViewportStore);
  const listRef = useRef<FlatList<ThreadMessageType>>(null);
  const metricsRef = useRef({
    contentHeight: 0,
    viewportHeight: 0,
    scrollY: 0,
  });
  const jumpRef = useRef<
    | {
        id: string;
        retried: boolean;
        timer: ReturnType<typeof setTimeout> | undefined;
      }
    | undefined
  >(undefined);
  const { Rail } = components;

  useEffect(() => () => clearTimeout(jumpRef.current?.timer), []);

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
      metricsRef.current.contentHeight = height;
      publishDescent();
    },
    [publishDescent],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      metricsRef.current.viewportHeight = height;
      const snapshot = store.getSnapshot();
      if (height !== snapshot.height || y !== snapshot.top) {
        store.publish({ height, top: y });
      }
      publishDescent();
    },
    [publishDescent, store],
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
        {followsKeyboard ? (
          <IosWelcome />
        ) : (
          <View className="flex-1 justify-center">
            <WelcomeSlot />
          </View>
        )}
      </AuiIf>
      <AuiIf condition={isHistoryLoadingView}>
        <View className="flex-1">
          <ThreadHistorySkeleton />
        </View>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.messages.length > 0 || !!notice}>
        {history?.isLoadingMore && <HistoryEdge />}
        <ThreadPrimitive.MessagesFlatList
          // Viewability props cannot change once a FlatList is mounted.
          key={Rail ? "tracked" : "plain"}
          ref={listRef}
          className="aui-message-group flex-1"
          contentContainerClassName={cn(
            "gap-6 px-4 pt-4",
            !floatsComposer && "pb-6",
            Rail && "pl-10",
          )}
          contentContainerStyle={
            floatsComposer
              ? {
                  // Resting messages clear the floating controls, but can scroll behind them.
                  paddingTop: insets.top + 80,
                  paddingBottom: composerOverlayHeight + 24,
                }
              : undefined
          }
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={notice ? <ThreadNotice {...notice} /> : null}
          {...(Rail
            ? {
                onContentSizeChange: onListContentSizeChange,
                onLayout: onListLayout,
                onScroll: onListScroll,
                onScrollToIndexFailed,
                onViewableItemsChanged,
                viewabilityConfig: MESSAGE_VIEWABILITY,
              }
            : {})}
          {...(history ? { history } : {})}
        >
          {() => <ThreadMessage />}
        </ThreadPrimitive.MessagesFlatList>
      </AuiIf>
      <View
        pointerEvents={floatsComposer ? "box-none" : undefined}
        className={floatsComposer ? "absolute inset-x-0 bottom-0" : undefined}
        onLayout={floatsComposer ? measureComposerOverlay : undefined}
      >
        <AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
          <View
            pointerEvents={floatsComposer ? "box-none" : undefined}
            className="px-4 pb-4"
          >
            <ThreadSuggestions />
          </View>
        </AuiIf>
        <View
          pointerEvents={floatsComposer ? "box-none" : undefined}
          className={Platform.OS === "ios" ? "aui-thread-viewport-footer px-3" : "aui-thread-viewport-footer px-4"}
          style={{ paddingBottom: insets.bottom + (Platform.OS === "ios" ? 12 : 8) }}
        >
          <Composer autoFocus={autoFocus} focusNewChatKey={focusNewChatKey} />
        </View>
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
            <IosKeyboardLayout bottomInset={insets.bottom}>
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
    </ThreadComponentsContext.Provider>
  );
};

/** One UI-thread keyboard height drives the iOS composer and transcript together. */
const IosKeyboardLayout: FC<{ bottomInset: number; children: ReactNode }> = ({
  bottomInset,
  children,
}) => {
  // A chat can mount while the keyboard is already open (e.g. after sign-in).
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  useKeyboardHandler({
    onMove: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onInteractive: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onEnd: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
  }, []);
  const spacerStyle = useAnimatedStyle(() => ({
    // The footer already includes the home-indicator inset while closed.
    height: Math.max(0, keyboardHeight.value - bottomInset),
  }), [bottomInset]);

  return (
    <KeyboardHeightContext.Provider value={keyboardHeight}>
      <View className="flex-1">
        {children}
        <Animated.View pointerEvents="none" style={spacerStyle} />
      </View>
    </KeyboardHeightContext.Provider>
  );
};

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
  return Welcome ? <Welcome /> : null;
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

// The placeholder color is a class to prop mapping that reads the CSSOM, so it applies from the first render after hydration.
const DefaultComposerInput: FC<{ autoFocus?: boolean }> = ({
  autoFocus,
}) => {
  const hydrated = useHydrated();
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const nativeInput = useRef<TextInput>(null);
  const focusOnMount = useRef(autoFocus);
  const placeholderColor = Platform.OS === "ios"
    ? "accent-muted-foreground/85"
    : "accent-muted-foreground/60";
  const inputProps = {
    placeholder: "Send a message...",
    placeholderTextColorClassName: hydrated ? placeholderColor : undefined,
    className: cn(
      "aui-composer-input text-foreground web:resize-none web:outline-none max-h-48 py-1",
      Platform.OS === "ios"
        ? "min-h-8 px-[13px] text-[17px] leading-6"
        : "min-h-10 px-2.5 text-base leading-6",
    ),
    multiline: true,
    accessibilityLabel: "Message input",
  };

  useEffect(() => {
    if (Platform.OS !== "ios" || !focusOnMount.current) return;
    // The initial native autoFocus can select the field before the window is
    // ready, leaving a caret but no keyboard. Focus after it has mounted.
    const timer = setTimeout(() => nativeInput.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  return Platform.OS === "ios" ? (
    <TextInput
      ref={nativeInput}
      value={text}
      onChangeText={(value) => aui.composer.setText(value)}
      {...inputProps}
    />
  ) : (
    <ComposerPrimitive.Input autoFocus={autoFocus} {...inputProps} />
  );
};

const Composer: FC<{ autoFocus?: boolean; focusNewChatKey: number }> = ({ autoFocus, focusNewChatKey }) => {
  const { ComposerInput = DefaultComposerInput } = useContext(
    ThreadComponentsContext,
  );
  // Start with a readable surface until the iOS accessibility setting is known.
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const [preparingAttachment, setPreparingAttachment] = useState(false);
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
  const showGlass = CAN_USE_LIQUID_GLASS && !reducedTransparency;

  return (
    <ComposerPrimitive.Root className="aui-composer-root w-full">
      <View
        className={cn(
          "aui-composer-shell relative rounded-3xl",
          Platform.OS === "ios" ? "gap-1 px-[2px] py-[6px]" : "gap-2 p-2",
        )}
      >
        {showGlass ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={GLASS_SURFACE_STYLE}
          />
        ) : (
          <View
            pointerEvents="none"
            className="border-border/60 dark:border-muted-foreground/15 bg-card absolute inset-0 rounded-3xl border"
          />
        )}
        <ComposerAttachments />
        <ComposerInput key={focusNewChatKey} autoFocus={autoFocus} />
        <ComposerAction
          preparingAttachment={preparingAttachment}
          onPreparingChange={setPreparingAttachment}
        />
      </View>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{
  preparingAttachment: boolean;
  onPreparingChange: (preparing: boolean) => void;
}> = ({ preparingAttachment, onPreparingChange }) => {
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
  const isIos = Platform.OS === "ios";

  return (
    <View className="aui-composer-action-wrapper flex-row items-center justify-between">
      <View className="flex-row items-center gap-1">
        <ComposerAddAttachment
          preparing={preparingAttachment}
          onPreparingChange={onPreparingChange}
        />
        {!isIos && <ComposerModelPicker disabled={preparingAttachment} />}
      </View>
      <View
        className={isIos ? "flex-row items-center gap-2" : "flex-row items-center gap-1.5"}
      >
        {isIos && <ComposerModelPicker disabled={preparingAttachment} />}
        <AuiIf
          condition={(s) =>
            s.composer.submission === undefined &&
            (!s.thread.isRunning || s.thread.voice !== undefined)
          }
        >
          <ComposerPrimitive.Send
            disabled={preparingAttachment || (isIos && !canSend)}
            className={cn(
              "aui-composer-send size-11 items-center justify-center",
              !isIos && "bg-primary active:bg-primary/90 rounded-full disabled:opacity-50",
            )}
            hitSlop={isIos ? undefined : iconButtonHitSlop}
            accessibilityLabel="Send message"
          >
            {isIos ? (
              <View className="size-8 items-center justify-center rounded-full bg-[#111114] dark:border dark:border-white/25">
                <Icon
                  as={ArrowUpIcon}
                  className={cn(
                    "aui-composer-send-icon size-5",
                    canSend && !preparingAttachment ? "text-white" : "text-white/50",
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
        </AuiIf>
        <AuiIf
          condition={(s) =>
            s.composer.submission !== undefined ||
            (s.thread.isRunning && s.thread.voice === undefined)
          }
        >
          <ComposerPrimitive.Cancel
            className={cn(
              "aui-composer-cancel size-11 items-center justify-center",
              !isIos && "bg-primary active:bg-primary/90 rounded-full",
            )}
            hitSlop={isIos ? undefined : iconButtonHitSlop}
            accessibilityLabel={
              isSending ? "Cancel sending" : "Stop generating"
            }
          >
            {isIos ? (
              <View className="size-8 items-center justify-center rounded-full bg-[#111114] dark:border dark:border-white/25">
                <View className="aui-composer-cancel-icon size-2.5 rounded-[2px] bg-white" />
              </View>
            ) : (
              <View className="aui-composer-cancel-icon bg-primary-foreground size-3 rounded-[2px]" />
            )}
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </View>
    </View>
  );
};

const MessageError: FC = () => (
  <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 dark:bg-destructive/5 mt-2 rounded-md border p-3">
    <ErrorPrimitive.Message
      className="aui-message-error-message text-destructive text-sm"
      numberOfLines={2}
    />
  </ErrorPrimitive.Root>
);

const UserText: TextMessagePartComponent = ({ text }) => (
  <Text
    className="aui-user-message-text text-foreground text-base leading-6"
    selectable
  >
    {text}
  </Text>
);

const AssistantIndicator: FC = () => {
  const isRunning = useAuiState((s) => s.message.status?.type === "running");
  if (!isRunning) return null;

  return (
    <TypingIndicator
      variant="bare"
      announce={false}
      className="aui-assistant-message-indicator py-2"
      accessibilityLabel="Assistant is working"
    />
  );
};

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
      | { toolName?: string; type?: string }
      | undefined;
    return (
      part?.type === "reasoning" || TIMELINE_TOOLS.has(part?.toolName ?? "")
    );
  };

  return (
    <MessagePrimitive.Root className="aui-assistant-message-root">
      <View className="aui-assistant-message-content px-2">
        <SessionTimeline />
        <MessageError />
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
                return (
                  <ToolGroup count={part.indices.length} active={part.status.type === "running"}>
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
                return <MarkdownText {...part} />;
              case "image":
                return <Image {...part} />;
              case "file":
                return <File {...part} />;
              case "reasoning":
                // Summarized by the timeline.
                return null;
              case "tool-call":
                if (TIMELINE_TOOLS.has(part.toolName)) {
                  // Summarized by the timeline above.
                  return null;
                }
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data":
                return part.dataRendererUI;
              case "indicator":
                return <AssistantIndicator />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </View>
      <View className="aui-assistant-message-footer ms-2 min-h-7.5 flex-row items-center pt-1.5">
        <BranchPicker />
        <AssistantActionBar />
      </View>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => (
  <AuiIf
    condition={(s) =>
      !(s.message.role === "assistant" && s.message.status?.type === "running")
    }
  >
    <View className="aui-assistant-action-bar-root -ms-1 flex-row gap-1">
      <ActionBarPrimitive.Copy
        copyToClipboard={copyToClipboard}
        className={iconButtonClassName}
        hitSlop={groupedIconButtonHitSlop}
        accessibilityLabel="Copy"
      >
        {({ isCopied }) => (
          <Icon
            as={isCopied ? CheckIcon : CopyIcon}
            className="text-muted-foreground size-4"
          />
        )}
      </ActionBarPrimitive.Copy>
    </View>
  </AuiIf>
);

const UserSendState: FC = () => {
  const phase = useAuiState((s) => s.message.metadata?.custom?.mobileSendState);
  if (phase !== "preparing" && phase !== "uncertain") return null;
  return (
    <Text
      className="text-muted-foreground text-xs"
      accessibilityRole={phase === "uncertain" ? "alert" : "text"}
    >
      {phase === "preparing" ? "Sending…" : "Delivery not confirmed. Check before resending."}
    </Text>
  );
};

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="aui-user-message-root items-end gap-y-2 px-2">
    <UserMessageAttachments />
    <View className="aui-user-message-content bg-muted max-w-[85%] rounded-xl px-4 py-2">
      <MessagePrimitive.Parts components={{ Text: UserText, Image, File }} />
    </View>
    <View className="aui-user-message-footer -me-1 flex-row items-center justify-end gap-2">
      <UserSendState />
      <BranchPicker />
    </View>
  </MessagePrimitive.Root>
);

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
