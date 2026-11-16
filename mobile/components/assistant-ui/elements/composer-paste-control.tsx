import * as Clipboard from "expo-clipboard";
import { ClipboardPasteIcon } from "lucide-react-native";
import { useCallback, type FC } from "react";
import { Alert, Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { normalizeClipboardText } from "@/src/clipboard-paste";
import { iconButtonHitSlop } from "./icon-button";

export type ComposerPastePayload =
  | { readonly kind: "image"; readonly dataUrl: string }
  | { readonly kind: "text"; readonly text: string };

type ComposerPasteControlProps = {
  readonly disabled: boolean;
  readonly onPaste: (payload: ComposerPastePayload) => void;
};

/**
 * System paste into the chat composer: iOS UIPasteControl (no permission
 * prompt) when available; Android reads the clipboard on press.
 */
export const ComposerPasteControl: FC<ComposerPasteControlProps> = ({
  disabled,
  onPaste,
}) => {
  const emitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onPaste({ kind: "text", text: trimmed });
    },
    [onPaste],
  );

  const emitImage = useCallback(
    (dataUrl: string) => {
      if (!dataUrl.trim()) return;
      onPaste({ kind: "image", dataUrl });
    },
    [onPaste],
  );

  const pasteAndroid = useCallback(() => {
    if (disabled) return;
    void (async () => {
      try {
        if (await Clipboard.hasImageAsync()) {
          const image = await Clipboard.getImageAsync({
            format: "jpeg",
            jpegQuality: 0.9,
          });
          if (image?.data) {
            emitImage(image.data);
            return;
          }
        }
        const text = normalizeClipboardText({
          text: await Clipboard.getStringAsync(),
        });
        if (text) {
          emitText(text);
          return;
        }
        Alert.alert("Nothing to paste", "Copy text or an image first.");
      } catch (cause) {
        Alert.alert(
          "Could not paste",
          cause instanceof Error ? cause.message : "Try again.",
        );
      }
    })();
  }, [disabled, emitImage, emitText]);

  if (Platform.OS === "ios" && Clipboard.isPasteButtonAvailable) {
    return (
      <View
        pointerEvents={disabled ? "none" : "auto"}
        style={{ opacity: disabled ? 0.5 : 1 }}
        className="size-8 overflow-hidden rounded-full"
      >
        <Clipboard.ClipboardPasteButton
          acceptedContentTypes={["plain-text", "html", "image", "url"]}
          displayMode="iconOnly"
          imageOptions={{ format: "jpeg", jpegQuality: 0.9 }}
          onPress={(data) => {
            if (disabled) return;
            if (data.type === "image") {
              emitImage(data.data);
              return;
            }
            const raw = "text" in data ? data.text : "";
            // UIPasteControl can deliver HTML/URL under type "text".
            const looksHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
            const text = normalizeClipboardText({
              text: looksHtml ? null : raw,
              html: looksHtml ? raw : null,
              url: /^https?:\/\//i.test(raw.trim()) ? raw.trim() : null,
            });
            if (text) emitText(text);
          }}
          style={{ width: 32, height: 32 }}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Paste"
      disabled={disabled}
      hitSlop={iconButtonHitSlop}
      onPress={pasteAndroid}
      className="bg-muted active:bg-muted/80 size-11 items-center justify-center rounded-full"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Icon as={ClipboardPasteIcon} className="text-muted-foreground size-5" />
    </Pressable>
  );
};
