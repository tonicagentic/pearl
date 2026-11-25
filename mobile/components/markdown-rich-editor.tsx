import { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  TextInput,
  UIManager,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "react-native-enriched-markdown";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type MarkdownRichEditorProps = {
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly editable?: boolean;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly inputStyle?: StyleProp<TextStyle>;
  readonly onChangeMarkdown?: (markdown: string) => void;
  /** When true, hide the formatting toolbar (native selection menu still works). */
  readonly hideToolbar?: boolean;
  /** Force plain TextInput (e.g. non-markdown files). */
  readonly plainText?: boolean;
};

type ToolbarButtonProps = {
  readonly label: string;
  readonly active?: boolean;
  readonly onPress: () => void;
};

/**
 * True when the current binary linked `react-native-enriched-markdown`.
 * Expo Go and OTA-only installs cannot pick up new native modules — those
 * need a fresh EAS / `expo run:ios` binary.
 */
function isEnrichedMarkdownNativeAvailable(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }
  try {
    if (typeof UIManager.getViewManagerConfig === "function") {
      return (
        UIManager.getViewManagerConfig("EnrichedMarkdownTextInput") != null
      );
    }
    return (
      (UIManager as Record<string, unknown>).EnrichedMarkdownTextInput != null
    );
  } catch {
    return false;
  }
}

const ENRICHED_MARKDOWN_NATIVE = isEnrichedMarkdownNativeAvailable();

function ToolbarButton({ label, active, onPress }: ToolbarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "min-h-9 min-w-9 items-center justify-center rounded-md px-2",
        active ? "bg-foreground/15" : "bg-transparent",
      )}
      onPress={onPress}
    >
      <Text
        className={cn(
          "text-sm font-semibold",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PlainMarkdownEditor({
  defaultValue = "",
  placeholder = "Write…",
  editable = true,
  autoFocus = false,
  className,
  inputStyle,
  onChangeMarkdown,
}: MarkdownRichEditorProps) {
  const muted = useCSSVariable("--color-muted-foreground");
  const handleChange = useCallback(
    (markdown: string) => {
      onChangeMarkdown?.(markdown);
    },
    [onChangeMarkdown],
  );

  return (
    <TextInput
      autoFocus={autoFocus}
      className={cn("min-h-40 p-3 text-base text-foreground", className)}
      defaultValue={defaultValue}
      editable={editable}
      multiline
      onChangeText={handleChange}
      placeholder={placeholder}
      placeholderTextColor={typeof muted === "string" ? muted : undefined}
      style={[{ textAlignVertical: "top" }, inputStyle]}
      textAlignVertical="top"
    />
  );
}

/**
 * WYSIWYG markdown editor backed by react-native-enriched-markdown
 * (https://docs.expo.dev/guides/editing-richtext/). Falls back to a plain
 * multiline TextInput when `plainText` is set or the native module is not
 * in the installed binary (needs a fresh EAS/dev-client build).
 */
export function MarkdownRichEditor(props: MarkdownRichEditorProps) {
  const {
    defaultValue = "",
    placeholder = "Write…",
    editable = true,
    autoFocus = false,
    className,
    style,
    inputStyle,
    onChangeMarkdown,
    hideToolbar = false,
    plainText = false,
  } = props;

  const ref = useRef<EnrichedMarkdownTextInputInstance>(null);
  const [styleState, setStyleState] = useState<StyleState | null>(null);
  const foreground = useCSSVariable("--color-foreground");
  const muted = useCSSVariable("--color-muted-foreground");
  const background = useCSSVariable("--color-card");

  const handleChange = useCallback(
    (markdown: string) => {
      onChangeMarkdown?.(markdown);
    },
    [onChangeMarkdown],
  );

  if (plainText || !ENRICHED_MARKDOWN_NATIVE) {
    return <PlainMarkdownEditor {...props} />;
  }

  return (
    <View className={cn("overflow-hidden rounded-lg", className)} style={style}>
      {hideToolbar || !editable ? null : (
        <View className="flex-row flex-wrap items-center gap-0.5 border-b border-border/50 px-1 py-1">
          <ToolbarButton
            active={styleState?.bold.isActive}
            label="B"
            onPress={() => ref.current?.toggleBold()}
          />
          <ToolbarButton
            active={styleState?.italic.isActive}
            label="I"
            onPress={() => ref.current?.toggleItalic()}
          />
          <ToolbarButton
            active={
              styleState?.heading.isActive && styleState.heading.level === 1
            }
            label="H1"
            onPress={() => ref.current?.toggleHeading(1)}
          />
          <ToolbarButton
            active={
              styleState?.heading.isActive && styleState.heading.level === 2
            }
            label="H2"
            onPress={() => ref.current?.toggleHeading(2)}
          />
          <ToolbarButton
            active={styleState?.unorderedList.isActive}
            label="•"
            onPress={() => ref.current?.toggleUnorderedList()}
          />
          <ToolbarButton
            active={styleState?.orderedList.isActive}
            label="1."
            onPress={() => ref.current?.toggleOrderedList()}
          />
          <ToolbarButton
            active={styleState?.strikethrough.isActive}
            label="S"
            onPress={() => ref.current?.toggleStrikethrough()}
          />
        </View>
      )}
      <EnrichedMarkdownTextInput
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        editable={editable}
        multiline
        onChangeMarkdown={handleChange}
        onChangeState={setStyleState}
        placeholder={placeholder}
        placeholderTextColor={typeof muted === "string" ? muted : undefined}
        ref={ref}
        scrollEnabled
        style={[
          {
            minHeight: 160,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            color: typeof foreground === "string" ? foreground : undefined,
            backgroundColor:
              typeof background === "string" ? background : undefined,
            ...(Platform.OS === "android"
              ? { textAlignVertical: "top" as const }
              : null),
          },
          inputStyle,
        ]}
      />
    </View>
  );
}
