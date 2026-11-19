import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import * as Haptics from "expo-haptics";

import { HistoryDrawerPanel } from "@/components/home/history-drawer-panel";
import { HistorySidebarButton } from "@/components/home/history-sidebar-button";
import { useChats } from "@/src/chat-context";

const SPRING = { damping: 28, stiffness: 280, mass: 0.9 } as const;
const EDGE_WIDTH = 24;
const MAX_PANEL_WIDTH = 320;
/** Rounded peek card (ChatGPT-style). */
const SHEET_RADIUS = 38;
const HANDLE_SIZE = 44;
const DRAWER_SCALE_FROM = 0.92;
const BLUR_MAX = 28;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type HistorySidebarContextValue = {
  readonly open: boolean;
  readonly openSidebar: () => void;
  readonly closeSidebar: () => void;
  readonly toggleSidebar: () => void;
  /**
   * Mail home registers a handler so drawer chat picks land on the Pearl
   * tab’s embedded chat instead of pushing `/chat`.
   */
  readonly setHomeChatHandler: (handler: (() => void) | null) => void;
};

const HistorySidebarContext = createContext<HistorySidebarContextValue | null>(
  null,
);

export function useHistorySidebar() {
  const value = useContext(HistorySidebarContext);
  if (!value) {
    throw new Error("useHistorySidebar must be used within HistorySidebarHost");
  }
  return value;
}

export function useHistorySidebarOptional() {
  return useContext(HistorySidebarContext);
}

/**
 * ChatGPT-style history drawer: sidebar sits underneath, scales up, and
 * clears from blur; the main stack slides right as a rounded card.
 */
export function HistorySidebarHost({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const { reloadChats } = useChats();
  const panelWidth = Math.min(MAX_PANEL_WIDTH, Math.round(windowWidth * 0.82));
  const isHomeRoot = pathname === "/" || pathname === "";
  const sidebarFill = pageBackground ?? "#F7F7F8";
  const sheetFill = pageBackground ?? "#FFFFFF";

  const openProgress = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const homeChatHandlerRef = useRef<(() => void) | null>(null);

  const setHomeChatHandler = useCallback((handler: (() => void) | null) => {
    homeChatHandlerRef.current = handler;
  }, []);

  const finishClose = useCallback(() => {
    setOpen(false);
  }, []);

  const finishOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const animateTo = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true);
        void reloadChats({ silent: true });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
      }
      openProgress.value = withSpring(nextOpen ? 1 : 0, SPRING, (finished) => {
        if (!finished) return;
        if (nextOpen) {
          runOnJS(finishOpen)();
        } else {
          runOnJS(finishClose)();
        }
      });
    },
    [finishClose, finishOpen, openProgress, reloadChats],
  );

  const openSidebar = useCallback(() => {
    animateTo(true);
  }, [animateTo]);

  const closeSidebar = useCallback(() => {
    animateTo(false);
  }, [animateTo]);

  const toggleSidebar = useCallback(() => {
    animateTo(!open);
  }, [animateTo, open]);

  const contextValue = useMemo(
    () => ({
      open,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      setHomeChatHandler,
    }),
    [open, openSidebar, closeSidebar, toggleSidebar, setHomeChatHandler],
  );

  const settleFromGesture = useCallback(
    (shouldOpen: boolean) => {
      setOpen(shouldOpen);
      if (shouldOpen) {
        void reloadChats({ silent: true });
      }
    },
    [reloadChats],
  );

  const dragGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-24, 24])
      .onBegin(() => {
        "worklet";
        dragStartProgress.value = openProgress.value;
      })
      .onUpdate((event) => {
        "worklet";
        const next = dragStartProgress.value + event.translationX / panelWidth;
        openProgress.value = Math.min(1, Math.max(0, next));
      })
      .onEnd((event) => {
        "worklet";
        const projected =
          openProgress.value + (event.velocityX / panelWidth) * 0.18;
        const flingOpen = event.velocityX > 450;
        const flingClose = event.velocityX < -450;
        const shouldOpen = flingOpen
          ? true
          : flingClose
            ? false
            : projected > 0.5;
        openProgress.value = withSpring(
          shouldOpen ? 1 : 0,
          SPRING,
          (finished) => {
            if (finished) {
              runOnJS(settleFromGesture)(shouldOpen);
            }
          },
        );
      });
  }, [dragStartProgress, openProgress, panelWidth, settleFromGesture]);

  const edgeOpenGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(isHomeRoot && !open)
      .activeOffsetX([6, 40])
      .failOffsetY([-16, 16])
      .onBegin(() => {
        "worklet";
        dragStartProgress.value = openProgress.value;
      })
      .onUpdate((event) => {
        "worklet";
        const next = Math.min(
          1,
          Math.max(0, dragStartProgress.value + event.translationX / panelWidth),
        );
        openProgress.value = next;
      })
      .onEnd((event) => {
        "worklet";
        const projected =
          openProgress.value + (event.velocityX / panelWidth) * 0.18;
        const flingOpen = event.velocityX > 450;
        const flingClose = event.velocityX < -450;
        const shouldOpen = flingOpen
          ? true
          : flingClose
            ? false
            : projected > 0.5;
        openProgress.value = withSpring(
          shouldOpen ? 1 : 0,
          SPRING,
          (finished) => {
            if (finished) {
              runOnJS(settleFromGesture)(shouldOpen);
            }
          },
        );
      });
  }, [
    dragStartProgress,
    isHomeRoot,
    open,
    openProgress,
    panelWidth,
    settleFromGesture,
  ]);

  const sheetTapClose = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        "worklet";
        runOnJS(closeSidebar)();
      }),
    [closeSidebar],
  );

  const openSheetGesture = useMemo(
    () => Gesture.Exclusive(sheetTapClose, dragGesture),
    [dragGesture, sheetTapClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: openProgress.value * panelWidth }],
    shadowOpacity: interpolate(
      openProgress.value,
      [0, 1],
      [0, 0.1],
      Extrapolation.CLAMP,
    ),
  }));

  const sheetClipStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      openProgress.value,
      [0, 1],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP,
    );
    return {
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      borderTopRightRadius: radius,
      borderBottomRightRadius: radius,
      overflow: "hidden" as const,
      flex: 1,
    };
  });

  const sidebarStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      openProgress.value,
      [0, 1],
      [DRAWER_SCALE_FROM, 1],
      Extrapolation.CLAMP,
    );
    // Compensate RN's center transform origin so scale grows toward the sheet.
    const leftOriginShift = ((1 - scale) * panelWidth) / 2;
    return {
      opacity: interpolate(
        openProgress.value,
        [0, 0.2, 1],
        [0, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX:
            interpolate(openProgress.value, [0, 1], [-24, 0]) + leftOriginShift,
        },
        { scale },
      ],
    };
  });

  // Drawer: frosted while scaled down → clear at full open.
  const drawerBlurProps = useAnimatedProps(() => ({
    intensity: interpolate(
      openProgress.value,
      [0, 1],
      [BLUR_MAX, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const drawerBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openProgress.value,
      [0, 0.55, 1],
      [1, 0.45, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const handleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openProgress.value,
      [0.55, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          openProgress.value,
          [0.55, 1],
          [-12, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const onSelectChat = useCallback(
    (_chatId: string) => {
      // selectChat already ran in the list; keep the thread on home embed.
      homeChatHandlerRef.current?.();
      closeSidebar();
      if (isHomeRoot) return;
      try {
        router.dismissTo("/");
      } catch {
        router.replace("/");
      }
    },
    [closeSidebar, isHomeRoot],
  );

  return (
    <HistorySidebarContext.Provider value={contextValue}>
      <View style={[styles.root, { backgroundColor: sidebarFill }]}>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.sidebar,
            {
              width: panelWidth,
              backgroundColor: sidebarFill,
              paddingTop: insets.top,
            },
            sidebarStyle,
          ]}
        >
          <HistoryDrawerPanel
            onClose={closeSidebar}
            onOpenChat={onSelectChat}
          />
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, drawerBlurStyle]}
          >
            <AnimatedBlurView
              animatedProps={drawerBlurProps}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              shadowColor: "#000",
              shadowRadius: 20,
              shadowOffset: { width: -4, height: 0 },
              elevation: open ? 8 : 0,
            },
            sheetStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                backgroundColor: sheetFill,
              },
              sheetClipStyle,
            ]}
          >
            <View
              pointerEvents={open ? "none" : "auto"}
              style={styles.sheetContent}
            >
              {children}
            </View>

            {isHomeRoot ? (
              <GestureDetector gesture={edgeOpenGesture}>
                <View
                  pointerEvents={open ? "none" : "box-only"}
                  style={[styles.edge, { width: EDGE_WIDTH }]}
                />
              </GestureDetector>
            ) : null}

            {open ? (
              <GestureDetector gesture={openSheetGesture}>
                <View style={styles.sheetHitLayer} />
              </GestureDetector>
            ) : null}

            <Animated.View
              pointerEvents={open ? "box-none" : "none"}
              style={[
                styles.handleWrap,
                { top: Math.max(insets.top, 12) + 4 },
                handleStyle,
              ]}
            >
              <HistorySidebarButton
                accessibilityLabel="Close history"
                onPress={closeSidebar}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </HistorySidebarContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sidebar: {
    ...StyleSheet.absoluteFill,
    right: undefined,
    zIndex: 1,
  },
  sheet: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  sheetContent: {
    flex: 1,
  },
  sheetHitLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  edge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  handleWrap: {
    position: "absolute",
    left: 14,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    zIndex: 60,
  },
});
