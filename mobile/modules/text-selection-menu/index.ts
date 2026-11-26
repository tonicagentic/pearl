import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type BookmarkEvent = {
  readonly text: string;
};

type TextSelectionMenuNative = {
  addListener(
    event: "onBookmark",
    listener: (event: BookmarkEvent) => void,
  ): { remove(): void };
};

/**
 * iOS: listens for Bookmark in the native text selection menu.
 * Other platforms: no-op (action-bar bookmark still works).
 */
export function subscribeSelectionBookmark(
  listener: (text: string) => void,
): { remove(): void } {
  if (Platform.OS !== "ios") {
    return { remove() {} };
  }
  try {
    const native =
      requireNativeModule<TextSelectionMenuNative>("TextSelectionMenu");
    return native.addListener("onBookmark", (event) => {
      const text = typeof event?.text === "string" ? event.text.trim() : "";
      if (text) listener(text);
    });
  } catch {
    return { remove() {} };
  }
}
