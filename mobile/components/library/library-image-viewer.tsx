import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  View,
  useWindowDimensions,
} from "react-native";
import {
  FlatList,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  clamp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import { ShareIcon, XIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  artifactAuthHeaders,
  artifactContentUrl,
  downloadArtifactToCache,
  type ArtifactDto,
} from "@/src/artifacts-client";

export type ViewerOrigin = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const OPEN_SPRING = { damping: 28, stiffness: 320, mass: 0.9 } as const;
const CLOSE_MS = 240;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

type LibraryImageViewerProps = {
  readonly images: readonly ArtifactDto[];
  readonly index: number;
  readonly origin: ViewerOrigin | null;
  readonly onClose: () => void;
  readonly onIndexChange?: (index: number) => void;
};

/**
 * Full-screen library gallery: springs open from a thumbnail rect, pages
 * horizontally, and supports pinch / double-tap zoom per image.
 */
export function LibraryImageViewer({
  images,
  index,
  origin,
  onClose,
  onIndexChange,
}: LibraryImageViewerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(index);
  const [sharing, setSharing] = useState(false);
  const [pagerLocked, setPagerLocked] = useState(false);
  const openedRef = useRef(false);
  const listRef = useRef<FlatList<ArtifactDto>>(null);
  const zoomResettersRef = useRef(new Map<string, () => void>());
  const imagesRef = useRef(images);
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  const progress = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const originW = useSharedValue(0);
  const originH = useSharedValue(0);

  const open = images.length > 0 && index >= 0;

  /* eslint-disable react-hooks/immutability -- Reanimated shared values */
  /* eslint-disable react-hooks/set-state-in-effect -- mount + spring driven by open prop */
  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      setMounted(false);
      progress.value = 0;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setCurrentIndex(index);
    const fallback = fallbackOrigin(windowWidth, windowHeight);
    const next = origin ?? fallback;
    originX.value = next.x;
    originY.value = next.y;
    originW.value = next.width;
    originH.value = next.height;
    progress.value = 0;
    setMounted(true);
    progress.value = withSpring(1, OPEN_SPRING);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: false });
    });
  }, [
    open,
    index,
    origin,
    windowWidth,
    windowHeight,
    originX,
    originY,
    originW,
    originH,
    progress,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const finishClose = useCallback(() => {
    openedRef.current = false;
    setMounted(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [finishClose, progress]);
  /* eslint-enable react-hooks/immutability */

  const current = images[currentIndex] ?? images[0] ?? null;

  const shareCurrent = useCallback(async () => {
    if (!current || sharing) return;
    setSharing(true);
    try {
      const file = await downloadArtifactToCache(current);
      if (Platform.OS === "ios") {
        await Share.share({ url: file.uri, title: current.basename });
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { dialogTitle: current.basename });
        return;
      }
      await Share.share({
        message: current.basename,
        title: current.basename,
      });
    } catch (cause) {
      Alert.alert(
        "Could not share",
        cause instanceof Error ? cause.message : "Try again.",
      );
    } finally {
      setSharing(false);
    }
  }, [current, sharing]);

  const registerZoomReset = useCallback(
    (pathname: string, reset: () => void) => {
      zoomResettersRef.current.set(pathname, reset);
      return () => {
        zoomResettersRef.current.delete(pathname);
      };
    },
    [],
  );

  const onZoomActiveChange = useCallback(
    (pathname: string, active: boolean) => {
      const current = images[currentIndex];
      if (!current || current.pathname !== pathname) return;
      setPagerLocked(active);
    },
    [currentIndex, images],
  );

  const onViewableItemsChanged = useCallback(
    (info: {
      viewableItems: readonly { index: number | null | undefined }[];
    }) => {
      const first = info.viewableItems[0];
      if (first?.index == null) return;
      const next = first.index;
      setCurrentIndex((prev) => {
        if (prev === next) return prev;
        const prevItem = imagesRef.current[prev];
        if (prevItem) {
          zoomResettersRef.current.get(prevItem.pathname)?.();
        }
        setPagerLocked(false);
        onIndexChangeRef.current?.(next);
        return next;
      });
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60 }),
    [],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const panelStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      position: "absolute" as const,
      left: interpolate(p, [0, 1], [originX.value, 0]),
      top: interpolate(p, [0, 1], [originY.value, 0]),
      right: interpolate(p, [0, 1], [
        windowWidth - originX.value - originW.value,
        0,
      ]),
      bottom: interpolate(p, [0, 1], [
        windowHeight - originY.value - originH.value,
        0,
      ]),
      borderRadius: interpolate(p, [0, 1], [12, 0]),
      overflow: "hidden" as const,
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1]),
  }));

  if (!open && !mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.92)",
            },
            backdropStyle,
          ]}
        />
        <Animated.View style={[{ backgroundColor: "#000" }, panelStyle]}>
          <FlatList
            ref={listRef}
            data={images as ArtifactDto[]}
            keyExtractor={(item) => item.pathname}
            horizontal
            pagingEnabled
            scrollEnabled={!pagerLocked}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index, Math.max(images.length - 1, 0))}
            getItemLayout={(_data, i) => ({
              length: windowWidth,
              offset: windowWidth * i,
              index: i,
            })}
            onScrollToIndexFailed={({ index: failed }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({
                  index: failed,
                  animated: false,
                });
              });
            }}
            onViewableItemsChanged={onViewableItemsChanged as never}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <ZoomableImagePage
                item={item}
                width={windowWidth}
                height={windowHeight}
                registerReset={registerZoomReset}
                onZoomActiveChange={onZoomActiveChange}
              />
            )}
          />

          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                paddingTop: Math.max(insets.top, 12),
                paddingHorizontal: 12,
                paddingBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              },
              chromeStyle,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={requestClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/45"
            >
              <Icon as={XIcon} className="size-5 text-white" />
            </Pressable>
            <Text
              variant="label"
              weight="medium"
              numberOfLines={1}
              className="min-w-0 flex-1 text-white"
            >
              {current?.basename ?? ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share"
              hitSlop={10}
              disabled={sharing || !current}
              onPress={() => void shareCurrent()}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/45"
              style={{ opacity: sharing ? 0.5 : 1 }}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Icon as={ShareIcon} className="size-5 text-white" />
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function fallbackOrigin(width: number, height: number): ViewerOrigin {
  const w = Math.min(width - 40, 180);
  const h = w;
  return {
    x: (width - w) / 2,
    y: height * 0.28,
    width: w,
    height: h,
  };
}

function ZoomableImagePage({
  item,
  width,
  height,
  registerReset,
  onZoomActiveChange,
}: {
  readonly item: ArtifactDto;
  readonly width: number;
  readonly height: number;
  readonly registerReset: (pathname: string, reset: () => void) => () => void;
  readonly onZoomActiveChange: (pathname: string, active: boolean) => void;
}) {
  /* Reanimated shared values are mutated via `.value` in worklets/callbacks. */
  /* eslint-disable react-hooks/immutability */
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const notifyZoom = useCallback(
    (active: boolean) => {
      onZoomActiveChange(item.pathname, active);
    },
    [item.pathname, onZoomActiveChange],
  );

  const resetZoom = useCallback(() => {
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    savedTX.value = 0;
    savedTY.value = 0;
    notifyZoom(false);
  }, [
    notifyZoom,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTX,
    savedTY,
  ]);

  useEffect(() => registerReset(item.pathname, resetZoom), [
    item.pathname,
    registerReset,
    resetZoom,
  ]);

  const composed = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        const next = clamp(
          savedScale.value * event.scale,
          MIN_SCALE,
          MAX_SCALE,
        );
        scale.value = next;
      })
      .onEnd(() => {
        if (scale.value < 1.05) {
          scale.value = withTiming(1);
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
          savedScale.value = 1;
          savedTX.value = 0;
          savedTY.value = 0;
          runOnJS(notifyZoom)(false);
          return;
        }
        savedScale.value = scale.value;
        savedTX.value = translateX.value;
        savedTY.value = translateY.value;
        runOnJS(notifyZoom)(true);
      });

    const pan = Gesture.Pan()
      .averageTouches(true)
      .manualActivation(true)
      .onTouchesMove((_event, state) => {
        // Fail at 1× so the horizontal pager can swipe between images.
        if (savedScale.value > 1.01 || scale.value > 1.01) {
          state.activate();
        } else {
          state.fail();
        }
      })
      .onUpdate((event) => {
        translateX.value = savedTX.value + event.translationX;
        translateY.value = savedTY.value + event.translationY;
      })
      .onEnd(() => {
        savedTX.value = translateX.value;
        savedTY.value = translateY.value;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        if (scale.value > 1.05) {
          scale.value = withTiming(1);
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
          savedScale.value = 1;
          savedTX.value = 0;
          savedTY.value = 0;
          runOnJS(notifyZoom)(false);
          return;
        }
        const next = DOUBLE_TAP_SCALE;
        const cx = event.x - width / 2;
        const cy = event.y - height / 2;
        scale.value = withTiming(next);
        translateX.value = withTiming(-cx * (next - 1));
        translateY.value = withTiming(-cy * (next - 1));
        savedScale.value = next;
        savedTX.value = -cx * (next - 1);
        savedTY.value = -cy * (next - 1);
        runOnJS(notifyZoom)(true);
      });

    // Pan only steals when zoomed so the pager can swipe at scale 1.
    return Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));
  }, [
    height,
    notifyZoom,
    savedScale,
    savedTX,
    savedTY,
    scale,
    translateX,
    translateY,
    width,
  ]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            {
              width,
              height,
              alignItems: "center",
              justifyContent: "center",
            },
            imageStyle,
          ]}
        >
          <Image
            source={{
              uri: artifactContentUrl(item.pathname),
              headers: artifactAuthHeaders(),
            }}
            style={{ width, height }}
            resizeMode="contain"
            accessibilityLabel={item.basename}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
  /* eslint-enable react-hooks/immutability */
}

/** Measure a view into window coords for the open animation origin. */
export function measureViewerOrigin(
  node: {
    measureInWindow: (
      callback: (x: number, y: number, width: number, height: number) => void,
    ) => void;
  } | null,
): Promise<ViewerOrigin | null> {
  return new Promise((resolve) => {
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (!(width > 0 && height > 0)) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}
