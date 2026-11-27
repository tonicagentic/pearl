import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import {
  CameraIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutRectangle,
} from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";
import { useCSSVariable } from "uniwind";

import {
  pinComposerIfKeyboardVisible,
  useComposerChrome,
} from "@/components/assistant-ui/elements/composer-chrome";
import { composerControlHitSlop } from "@/components/assistant-ui/elements/icon-button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { focusComposerInput } from "@/src/composer-input-focus";
import { DRAWER_SPRING_FAST } from "@/src/drawer-spring";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const POPOVER_RADIUS = 32;
const POPOVER_GAP = 10;
const POPOVER_WIDTH = 200;
const ROW_ICON_SIZE = 44;
const TRIGGER_VISUAL = Platform.OS === "ios" ? 32 : 44;
const ATTACHMENT_TOUCH = TRIGGER_VISUAL + composerControlHitSlop * 2;

export type AttachmentMenuProps = {
  disabled: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onChooseFile: () => void;
};

type MenuRowDef = {
  readonly key: string;
  readonly label: string;
  readonly iosSymbol: string;
  readonly androidSymbol: string;
  readonly lucide: LucideIcon;
  readonly action: "photo" | "library" | "file";
};

const ROWS: readonly MenuRowDef[] = [
  {
    key: "camera",
    label: "Camera",
    iosSymbol: "camera",
    androidSymbol: "photo_camera",
    lucide: CameraIcon,
    action: "photo",
  },
  {
    key: "photos",
    label: "Photos",
    iosSymbol: "photo.on.rectangle",
    androidSymbol: "photo_library",
    lucide: ImageIcon,
    action: "library",
  },
  {
    key: "files",
    label: "Files",
    iosSymbol: "paperclip",
    androidSymbol: "attach_file",
    lucide: PaperclipIcon,
    action: "file",
  },
];

type PopoverBodyProps = {
  readonly anchor: LayoutRectangle;
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly useGlass: boolean;
  readonly reducedTransparency: boolean;
  readonly foreground?: string;
  readonly card?: string;
  readonly muted?: string;
  readonly onDismissed: () => void;
  readonly onSelect: (action: MenuRowDef["action"]) => void;
};

function AttachmentPopoverBody({
  anchor,
  windowWidth,
  windowHeight,
  useGlass,
  reducedTransparency,
  foreground,
  card,
  muted,
  onDismissed,
  onSelect,
}: PopoverBodyProps) {
  const progress = useSharedValue(0);
  const closingRef = useRef(false);
  const pendingActionRef = useRef<MenuRowDef["action"] | null>(null);

  useLayoutEffect(() => {
    progress.value = 0;
    progress.value = withSpring(1, DRAWER_SPRING_FAST);
  }, [progress]);

  const finishClose = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    onDismissed();
    if (action) onSelect(action);
  }, [onDismissed, onSelect]);

  const animateClose = useCallback(
    (action?: MenuRowDef["action"]) => {
      if (closingRef.current) return;
      closingRef.current = true;
      if (action) pendingActionRef.current = action;
      progress.value = withSpring(0, DRAWER_SPRING_FAST, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
    },
    [finishClose, progress],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const p = Math.max(0.01, progress.value);
    return {
      opacity: progress.value,
      // Rise a few px out of the plus while scaling from its center.
      transform: [{ translateY: (1 - p) * 10 }, { scale: p }],
    };
  });

  const width = Math.min(POPOVER_WIDTH, windowWidth - 24);
  const left = Math.min(
    Math.max(8, anchor.x),
    windowWidth - width - 8,
  );
  // Grow upward from the trigger; origin is the plus (bottom, button center).
  const bottom = windowHeight - anchor.y + POPOVER_GAP;
  const originX = Math.min(Math.max(0, anchor.width / 2), width);

  // Gesture-handler Pressable wins the arena over the composer ScrollView.
  const DismissPressable = Platform.OS === "ios" ? GHPressable : Pressable;

  return (
    <View style={styles.modalRoot}>
      <DismissPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => animateClose()}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.cardWrap,
          {
            left,
            bottom,
            width,
            transformOrigin: `${originX}px 100%`,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.card,
            {
              borderRadius: POPOVER_RADIUS,
              borderCurve: "continuous",
            },
          ]}
        >
          {useGlass ? (
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              isInteractive
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: POPOVER_RADIUS },
              ]}
            />
          ) : Platform.OS === "ios" && !reducedTransparency ? (
            <BlurView
              pointerEvents="none"
              intensity={70}
              tint="systemChromeMaterial"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: POPOVER_RADIUS, overflow: "hidden" },
              ]}
            />
          ) : (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: POPOVER_RADIUS,
                  backgroundColor: card ?? "rgba(242,242,247,0.94)",
                },
              ]}
            />
          )}
          <View style={styles.rows}>
            {ROWS.map((row) => (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={() => animateClose(row.action)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View
                  style={[
                    styles.iconWell,
                    {
                      backgroundColor: muted ?? "rgba(120,120,128,0.14)",
                    },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: row.iosSymbol,
                      android: row.androidSymbol,
                      web: row.androidSymbol,
                    }}
                    size={20}
                    weight="regular"
                    tintColor={foreground ?? "#000"}
                    fallback={
                      <Icon
                        as={row.lucide}
                        size={20}
                        color={foreground ?? "#000"}
                        strokeWidth={1.75}
                      />
                    }
                  />
                </View>
                <Text variant="label" weight="medium">
                  {row.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * ChatGPT-style frosted attachment menu.
 * iOS: FullWindowOverlay keeps the text field first-responder (keyboard stays).
 * Android: Modal + immediate refocus.
 */
export function AttachmentMenu({
  disabled,
  onTakePhoto,
  onChoosePhoto,
  onChooseFile,
}: AttachmentMenuProps) {
  const chrome = useComposerChrome();
  const triggerRef = useRef<View>(null);
  const actionsRef = useRef({ onTakePhoto, onChoosePhoto, onChooseFile });
  actionsRef.current = { onTakePhoto, onChoosePhoto, onChooseFile };
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;
  const muted = useCSSVariable("--color-muted") as string | undefined;
  const useGlass = CAN_USE_LIQUID_GLASS && !reducedTransparency;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReducedTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceTransparencyChanged",
      setReducedTransparency,
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  // Reclaim focus if anything stole it (Android Modal; belt-and-suspenders on iOS).
  useEffect(() => {
    if (!open) return;
    const t1 = setTimeout(() => focusComposerInput(), 16);
    const t2 = setTimeout(() => focusComposerInput(), 80);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  const onSelect = useCallback((action: MenuRowDef["action"]) => {
    const handlers = actionsRef.current;
    if (action === "photo") handlers.onTakePhoto();
    else if (action === "library") handlers.onChoosePhoto();
    else handlers.onChooseFile();
  }, []);

  const handleDismissed = useCallback(() => {
    setOpen(false);
    setAnchor(null);
    // Restore caret after the overlay unmounts.
    requestAnimationFrame(() => focusComposerInput());
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    pinComposerIfKeyboardVisible(chrome);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, [chrome, disabled]);

  const body =
    open && anchor ? (
      <AttachmentPopoverBody
        anchor={anchor}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        useGlass={useGlass}
        reducedTransparency={reducedTransparency}
        foreground={foreground}
        card={card}
        muted={muted}
        onDismissed={handleDismissed}
        onSelect={onSelect}
      />
    ) : null;

  return (
    <View>
      <View
        ref={triggerRef}
        collapsable={false}
        style={{
          width: ATTACHMENT_TOUCH,
          height: ATTACHMENT_TOUCH,
          margin: -composerControlHitSlop,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add attachment"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={composerControlHitSlop}
          onPress={openMenu}
          style={[
            styles.trigger,
            {
              width: TRIGGER_VISUAL,
              height: TRIGGER_VISUAL,
              opacity: disabled ? 0.45 : 1,
            },
          ]}
        >
          <Icon
            as={PlusIcon}
            size={Platform.OS === "ios" ? 22 : 24}
            className="text-foreground"
            strokeWidth={1.75}
          />
        </Pressable>
      </View>

      {Platform.OS === "ios" ? (
        // Window-level overlay — does not present a VC / resign first responder.
        body ? <FullWindowOverlay>{body}</FullWindowOverlay> : null
      ) : (
        <Modal
          visible={open && anchor != null}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => handleDismissed()}
        >
          {body}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  trigger: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrap: {
    position: "absolute",
  },
  card: {
    overflow: "hidden",
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  rows: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  rowPressed: {
    opacity: 0.55,
  },
  iconWell: {
    width: ROW_ICON_SIZE,
    height: ROW_ICON_SIZE,
    borderRadius: ROW_ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
