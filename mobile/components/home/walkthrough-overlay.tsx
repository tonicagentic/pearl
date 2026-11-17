import { useCallback, useEffect, useState, type ComponentRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutRectangle,
} from "react-native";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import {
  loadWalkthroughDone,
  markWalkthroughDone,
} from "@/src/walkthrough-store";

const STEP = {
  title: "New chat",
  body: "Start a conversation whenever you want.",
} as const;

const ACCENT = "#4A90E2";

/**
 * Things-style coach marks on first guest launch. Measures home targets and
 * draws a dimmed mask with a blue ring + bubble.
 */
export function WalkthroughOverlay({
  composerRef,
}: {
  readonly composerRef: React.RefObject<ComponentRef<typeof View> | null>;
}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const { isAnonymous, restoring } = useAuth();
  const [ready, setReady] = useState(false);
  const [hole, setHole] = useState<LayoutRectangle | null>(null);

  useEffect(() => {
    if (restoring || !isAnonymous) {
      setReady(false);
      return;
    }
    let cancelled = false;
    void loadWalkthroughDone().then((done) => {
      if (!cancelled) setReady(!done);
    });
    return () => {
      cancelled = true;
    };
  }, [isAnonymous, restoring]);

  const measure = useCallback(() => {
    const target = composerRef.current;
    if (!target) {
      setHole(null);
      return;
    }
    target.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        setHole({ x, y, width, height });
      },
    );
  }, [composerRef]);

  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [measure, ready]);

  const finish = useCallback(() => {
    setReady(false);
    void markWalkthroughDone();
  }, []);

  if (!ready || !focused) return null;

  const pad = 6;
  const ring = hole
    ? {
        left: Math.max(0, hole.x - pad),
        top: Math.max(0, hole.y - pad),
        width: hole.width + pad * 2,
        height: hole.height + pad * 2,
      }
    : null;

  const bubbleHeight = 200;
  const belowTop = ring ? ring.top + ring.height + 14 : insets.top + 120;
  const placeAbove = ring
    ? belowTop + bubbleHeight > windowHeight - insets.bottom
    : false;
  const bubbleTop = placeAbove && ring
    ? Math.max(insets.top + 12, ring.top - bubbleHeight - 12)
    : belowTop;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        <View style={styles.dim} />
        {ring ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: ring.left,
                top: ring.top,
                width: ring.width,
                height: ring.height,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.bubble,
            {
              top: Math.min(bubbleTop, insets.top + 420),
              marginHorizontal: 20,
            },
          ]}
        >
          <View style={placeAbove ? styles.caretBelow : styles.caret} />
          <Text variant="title" className="mb-1.5">
            {STEP.title}
          </Text>
          <Text variant="body" tone="muted" className="mb-4 leading-[22px]">
            {STEP.body}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={finish}
            style={styles.cta}
          >
            <Text
              variant="label"
              weight="semibold"
              style={{ color: "#FFFFFF", textAlign: "center" }}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  ring: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: ACCENT,
    backgroundColor: "transparent",
  },
  bubble: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  caret: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    width: 16,
    height: 16,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  caretBelow: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    width: 16,
    height: 16,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
