import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useAui, useAuiState } from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  ArrowUpIcon,
  CopyIcon,
  Redo2Icon,
  ShareIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react-native";
import {
  KeyboardController,
  useKeyboardHandler,
} from "@/src/keyboard-controller";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { fileBasename } from "../../lib/design/file-preview";
import { previewKindForPath } from "../../lib/design/preview-kind";
import { shareWorkspaceFile } from "@/src/share-workspace-file";
import {
  useWorkspace,
  type CanvasOrigin,
} from "@/src/workspace-context";

const UNDO_CAP = 50;
const SAVE_DEBOUNCE_MS = 800;
const OPEN_SPRING = { damping: 28, stiffness: 320, mass: 0.9 } as const;
const CLOSE_MS = 240;
const ASK_BAR_HEIGHT = 56;
const ASK_BAR_GAP = 12;

type HistoryState = {
  readonly stack: string[];
  readonly index: number;
};

function pushHistory(prev: HistoryState, next: string): HistoryState {
  if (prev.stack[prev.index] === next) return prev;
  const trimmed = prev.stack.slice(0, prev.index + 1);
  trimmed.push(next);
  while (trimmed.length > UNDO_CAP) trimmed.shift();
  return { stack: trimmed, index: trimmed.length - 1 };
}

function fallbackOrigin(
  width: number,
  height: number,
): CanvasOrigin {
  const w = Math.min(width - 32, 420);
  const h = Math.min(height * 0.28, 220);
  return {
    x: (width - w) / 2,
    y: height * 0.28,
    width: w,
    height: h,
  };
}

/**
 * ChatGPT-style full-screen editable text/markdown canvas with a floating
 * Ask Pearl composer. Expands from the inline Writing card rect into
 * fullscreen (and shrinks back on close).
 */
export function FileCanvas() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  const muted = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const background = useCSSVariable("--color-background") as string | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;

  const {
    canvasOpen,
    canvasOrigin,
    activeFile,
    closeCanvas,
    updateFile,
    saveFile,
  } = useWorkspace();

  const aui = useAui();
  const threadRunning = useAuiState((s) => s.thread.isRunning);

  const path = activeFile?.path ?? "";
  const running = activeFile?.running ?? false;
  const fileContent = activeFile?.content ?? "";
  const dirty = activeFile?.dirty ?? false;

  const [draft, setDraft] = useState(fileContent);
  const [history, setHistory] = useState<HistoryState>({
    stack: [fileContent],
    index: 0,
  });
  const [askText, setAskText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const applyingAgentRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = useRef(false);

  const progress = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const originW = useSharedValue(0);
  const originH = useSharedValue(0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12);

  // Sync agent-owned buffer into the editor while streaming or after settle
  // when the user hasn't dirtied the tab.
  useEffect(() => {
    if (!mounted || !activeFile) return;
    if (activeFile.dirty && !activeFile.running) return;
    applyingAgentRef.current = true;
    setDraft(activeFile.content);
    setHistory({ stack: [activeFile.content], index: 0 });
    applyingAgentRef.current = false;
  }, [
    mounted,
    activeFile?.id,
    activeFile?.content,
    activeFile?.running,
    activeFile?.dirty,
    activeFile,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!canvasOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    const origin =
      canvasOrigin ?? fallbackOrigin(windowWidth, windowHeight);
    originX.value = origin.x;
    originY.value = origin.y;
    originW.value = origin.width;
    originH.value = origin.height;
    progress.value = 0;
    setMounted(true);
    progress.value = withSpring(1, OPEN_SPRING);
  }, [
    canvasOpen,
    canvasOrigin,
    windowWidth,
    windowHeight,
    originX,
    originY,
    originW,
    originH,
    progress,
  ]);

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
    },
    onEnd: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
  });

  const finishClose = useCallback(() => {
    openedRef.current = false;
    setMounted(false);
    closeCanvas();
  }, [closeCanvas]);

  const requestClose = useCallback(() => {
    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [finishClose, progress]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      setSaving(true);
      void saveFile(path).finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);
  }, [path, saveFile]);

  const onChangeText = useCallback(
    (next: string) => {
      if (applyingAgentRef.current) return;
      setDraft(next);
      setHistory((prev) => pushHistory(prev, next));
      if (activeFile) {
        updateFile({
          id: activeFile.id,
          content: next,
          dirty: true,
          running: false,
        });
      }
      scheduleSave();
    },
    [activeFile, scheduleSave, updateFile],
  );

  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const index = history.index - 1;
    const next = history.stack[index] ?? "";
    setHistory((prev) => ({ ...prev, index }));
    applyingAgentRef.current = true;
    setDraft(next);
    applyingAgentRef.current = false;
    if (activeFile) {
      updateFile({ id: activeFile.id, content: next, dirty: true });
    }
    scheduleSave();
    void Haptics.selectionAsync();
  }, [activeFile, canUndo, history, scheduleSave, updateFile]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const index = history.index + 1;
    const next = history.stack[index] ?? "";
    setHistory((prev) => ({ ...prev, index }));
    applyingAgentRef.current = true;
    setDraft(next);
    applyingAgentRef.current = false;
    if (activeFile) {
      updateFile({ id: activeFile.id, content: next, dirty: true });
    }
    scheduleSave();
    void Haptics.selectionAsync();
  }, [activeFile, canRedo, history, scheduleSave, updateFile]);

  const copyAll = useCallback(async () => {
    await Clipboard.setStringAsync(draft);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draft]);

  const shareDocument = useCallback(async () => {
    if (sharing || !path) return;
    setSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await shareWorkspaceFile({ path, content: draft });
    } finally {
      setSharing(false);
    }
  }, [draft, path, sharing]);

  const forceSaveThenSend = useCallback(async () => {
    const text = askText.trim();
    if (!text || threadRunning) return;
    if (dirty || activeFile?.dirty) {
      setSaving(true);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await saveFile(path);
      setSaving(false);
    }
    aui.composer.setText(text);
    setAskText("");
    aui.composer.send();
  }, [askText, threadRunning, dirty, activeFile?.dirty, saveFile, path, aui]);

  const kind = useMemo(
    () => (path ? previewKindForPath(path) : "text"),
    [path],
  );
  const monospace = kind === "text" || kind === "mermaid";
  const title = path ? fileBasename(path) : "Document";

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  // Pin to all four edges when open so the modal fills the screen — height-
  // only layouts leave a gap that makes the keyboard look floating.
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
      borderRadius: interpolate(p, [0, 1], [16, 0]),
      overflow: "hidden" as const,
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1]),
  }));

  // Sit Ask Pearl on the resting safe-area pad, or flush above the keyboard.
  const askBarStyle = useAnimatedStyle(() => ({
    bottom: Math.max(keyboardHeight.value, restingPad),
  }));

  const editorPadStyle = useAnimatedStyle(() => {
    const askClearance = ASK_BAR_HEIGHT + ASK_BAR_GAP;
    const kb = Math.max(0, keyboardHeight.value - restingPad);
    return {
      paddingBottom: askClearance + kb,
    };
  });

  if (!mounted || !activeFile) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <View className="flex-1" pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0"
          style={[
            { backgroundColor: background ?? "#000" },
            backdropStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              backgroundColor: background ?? "#111",
            },
            panelStyle,
          ]}
        >
          <Animated.View
            style={[{ flex: 1, paddingTop: insets.top }, chromeStyle]}
          >
            <View className="border-border flex-row items-center gap-1 border-b px-2 py-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close document"
                className="h-11 w-11 items-center justify-center"
                onPress={requestClose}
                hitSlop={8}
              >
                <Icon as={XIcon} className="text-foreground size-5" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo"
                disabled={!canUndo}
                className="h-11 w-11 items-center justify-center"
                style={{ opacity: canUndo ? 1 : 0.3 }}
                onPress={undo}
                hitSlop={8}
              >
                <Icon as={Undo2Icon} className="text-foreground size-5" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Redo"
                disabled={!canRedo}
                className="h-11 w-11 items-center justify-center"
                style={{ opacity: canRedo ? 1 : 0.3 }}
                onPress={redo}
                hitSlop={8}
              >
                <Icon as={Redo2Icon} className="text-foreground size-5" />
              </Pressable>
              <View className="min-w-0 flex-1 items-center px-2">
                <Text
                  variant="secondary"
                  weight="medium"
                  numberOfLines={1}
                  className="text-foreground"
                >
                  {title}
                </Text>
                {running || saving || dirty ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {running ? "Writing…" : saving ? "Saving…" : "Unsaved"}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share"
                disabled={sharing || draft.length === 0}
                className="h-11 w-11 items-center justify-center"
                style={{ opacity: sharing || draft.length === 0 ? 0.3 : 1 }}
                onPress={() => {
                  void shareDocument();
                }}
                hitSlop={8}
              >
                {sharing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Icon as={ShareIcon} className="text-foreground size-5" />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy"
                className="h-11 w-11 items-center justify-center"
                onPress={() => {
                  void copyAll();
                }}
                hitSlop={8}
              >
                <Icon as={CopyIcon} className="text-foreground size-5" />
              </Pressable>
            </View>

            <Animated.View style={[{ flex: 1 }, editorPadStyle]}>
              <TextInput
                value={draft}
                onChangeText={onChangeText}
                multiline
                textAlignVertical="top"
                editable={!running}
                autoCorrect={kind === "markdown"}
                autoCapitalize={kind === "markdown" ? "sentences" : "none"}
                className={cn(
                  "text-foreground flex-1 px-4 py-3 text-base leading-6",
                  monospace && "font-mono",
                )}
                style={foreground ? { color: foreground } : undefined}
                placeholder={running ? "Generating…" : "Start writing…"}
                placeholderTextColor={muted}
              />
            </Animated.View>

            <Animated.View
              pointerEvents="box-none"
              className="absolute inset-x-0 px-3"
              style={askBarStyle}
            >
              <View
                className="border-border flex-row items-end gap-2 rounded-full border px-2 py-1.5"
                style={{ backgroundColor: card ?? background }}
              >
                <TextInput
                  value={askText}
                  onChangeText={setAskText}
                  placeholder="Ask Pearl"
                  placeholderTextColor={muted}
                  multiline
                  className="text-foreground max-h-28 min-h-10 flex-1 px-2 py-2 text-base"
                  style={foreground ? { color: foreground } : undefined}
                  editable={!threadRunning}
                  onSubmitEditing={() => {
                    void forceSaveThenSend();
                  }}
                  blurOnSubmit={Platform.OS === "ios"}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  disabled={threadRunning || askText.trim().length === 0}
                  className="bg-foreground mb-0.5 h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    opacity:
                      threadRunning || askText.trim().length === 0 ? 0.4 : 1,
                  }}
                  onPress={() => {
                    void forceSaveThenSend();
                  }}
                >
                  {threadRunning ? (
                    <ActivityIndicator color={background} size="small" />
                  ) : (
                    <Icon as={ArrowUpIcon} className="size-4 text-background" />
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}
