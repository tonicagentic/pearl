import { useEffect, useMemo } from "react";
import {
  type SharedValue,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";

import { dismissKeyboard } from "@/components/dismiss-keyboard";

/** Settle spring for the chat ↔ history push. */
export const PUSH_SPRING = { damping: 28, stiffness: 280, mass: 0.9 } as const;

type SettleHandler = (open: boolean) => void;

// Module-level settle bridge so gesture worklets never close over React
// components that import Keyboard (KeyboardImpl is not worklet-serializable).
let settleHandler: SettleHandler | null = null;

export function setChatHistoryPushSettleHandler(handler: SettleHandler | null) {
  settleHandler = handler;
}

function notifySettled(open: boolean) {
  settleHandler?.(open);
}

/** Animate openProgress to 0 or 1, then notify JS when the spring finishes. */
export function animateChatHistoryPush(
  openProgress: SharedValue<number>,
  settling: SharedValue<boolean>,
  open: boolean,
) {
  settling.value = true;
  openProgress.value = withSpring(open ? 1 : 0, PUSH_SPRING, (finished) => {
    if (finished) {
      runOnJS(notifySettled)(open);
    } else {
      settling.value = false;
    }
  });
}

/**
 * Horizontal pan that drives `openProgress` (0 chat → 1 history) with the
 * finger, then springs to the nearer edge.
 */
export function useChatHistoryPushGesture({
  openProgress,
  dragStartProgress,
  settling,
  width,
}: {
  openProgress: SharedValue<number>;
  dragStartProgress: SharedValue<number>;
  settling: SharedValue<boolean>;
  width: number;
}) {
  return useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          "worklet";
          settling.value = false;
          dragStartProgress.value = openProgress.value;
          if (openProgress.value < 0.5) {
            runOnJS(dismissKeyboard)();
          }
        })
        .onUpdate((event) => {
          "worklet";
          const next = dragStartProgress.value + event.translationX / width;
          openProgress.value = Math.min(1, Math.max(0, next));
        })
        .onEnd((event) => {
          "worklet";
          const projected =
            openProgress.value + (event.velocityX / width) * 0.18;
          const flingOpen = event.velocityX > 450;
          const flingClose = event.velocityX < -450;
          const shouldOpen = flingOpen
            ? true
            : flingClose
              ? false
              : projected > 0.5;
          settling.value = true;
          openProgress.value = withSpring(
            shouldOpen ? 1 : 0,
            PUSH_SPRING,
            (finished) => {
              if (finished) {
                runOnJS(notifySettled)(shouldOpen);
              } else {
                settling.value = false;
              }
            },
          );
        }),
    [dragStartProgress, openProgress, settling, width],
  );
}

/** Register the settle handler for the lifetime of the chat screen. */
export function useChatHistoryPushSettle(handler: SettleHandler) {
  useEffect(() => {
    setChatHistoryPushSettleHandler(handler);
    return () => setChatHistoryPushSettleHandler(null);
  }, [handler]);
}
