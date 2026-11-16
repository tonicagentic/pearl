import { useCallback, useEffect, useState, type ComponentRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import {
  loadWalkthroughDone,
  markWalkthroughDone,
} from "@/src/walkthrough-store";

type StepId = "composer" | "prompts";

type Step = {
  readonly id: StepId;
  readonly title: string;
  readonly body: string;
};

const STEPS: readonly Step[] = [
  {
    id: "composer",
    title: "Ask Pearl",
    body: "Start a conversation whenever you want.",
  },
  {
    id: "prompts",
    title: "Try one of these",
    body: "Tap a prompt to send it, or type your own.",
  },
];

const ACCENT = "#4A90E2";

/**
 * Things-style coach marks on first guest launch. Measures home targets and
 * draws a dimmed mask with a blue ring + bubble.
 */
export function WalkthroughOverlay({
  composerRef,
  chipsRef,
  composeActive,
  onActivateCompose,
}: {
  readonly composerRef: React.RefObject<ComponentRef<typeof View> | null>;
  readonly chipsRef: React.RefObject<ComponentRef<typeof View> | null>;
  readonly composeActive: boolean;
  readonly onActivateCompose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isAnonymous, restoring } = useAuth();
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
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

  const step = STEPS[stepIndex] ?? STEPS[0];

  const measure = useCallback(() => {
    const target =
      step.id === "composer" ? composerRef.current : chipsRef.current;
    if (!target) {
      setHole(null);
      return;
    }
    target.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        setHole({ x, y, width, height });
      },
    );
  }, [chipsRef, composerRef, step.id]);

  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [measure, ready, stepIndex, composeActive]);

  const finish = useCallback(() => {
    setReady(false);
    void markWalkthroughDone();
  }, []);

  const advance = useCallback(() => {
    if (step.id === "composer") {
      onActivateCompose();
      setStepIndex(1);
      return;
    }
    finish();
  }, [finish, onActivateCompose, step.id]);

  if (!ready) return null;

  const pad = 6;
  const ring = hole
    ? {
        left: Math.max(0, hole.x - pad),
        top: Math.max(0, hole.y - pad),
        width: hole.width + pad * 2,
        height: hole.height + pad * 2,
      }
    : null;

  const bubbleTop = ring
    ? ring.top + ring.height + 14
    : insets.top + 120;

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
          <View style={styles.caret} />
          <Text variant="title" className="mb-1.5">
            {step.title}
          </Text>
          <Text variant="body" tone="muted" className="mb-4 leading-[22px]">
            {step.body}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={advance}
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
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
