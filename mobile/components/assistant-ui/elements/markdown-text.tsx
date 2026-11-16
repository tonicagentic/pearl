import { useHydrated } from "@/components/assistant-ui/elements/surfaces";
import {
  isCitationLabel,
  linkChildrenToText,
} from "@/components/assistant-ui/elements/citation";
import { FilePreviewCard } from "@/components/assistant-ui/elements/file-preview-card";
import { openWebUrl } from "@/src/open-web-url";
import { traceStream } from "@/src/stream-trace";
import type { TextMessagePartProps } from "@assistant-ui/react-native";
import {
  type FC,
  Fragment,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import {
  type MarkedStyles,
  MarkedTokenizer,
  Renderer,
  useMarkdown,
  type useMarkdownHookOptions,
} from "react-native-marked";
import { useCSSVariable, useUniwind } from "uniwind";

import { TEXT_METRICS, Text, textVariants } from "@/components/ui/text";

const MONOSPACE = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const BODY_SIZE = TEXT_METRICS.label.fontSize;
const BODY_LINE = TEXT_METRICS.label.lineHeight;
const MUTED_SIZE = TEXT_METRICS.body.fontSize;
const MUTED_LINE = TEXT_METRICS.body.lineHeight;

/** Match user/spoken selection highlight. */
const SELECTION_COLOR = "rgba(127, 127, 127, 0.35)";

/** Match web `ms-5` / ChatGPT-style hanging lists (marker gutter + wrap align). */
const LIST_INDENT = 12;
const LIST_MARKER_SLOT = 20;
const LIST_ITEM_GAP = 4;
/** Space between paragraphs / lists — tighter than a full blank `\n\n` line. */
const BLOCK_GAP = 8;
/** U+25CF BLACK CIRCLE — fuller than U+2022 • at the same point size. */
const LIST_BULLET = "\u25CF";

/** View hosts (lists, file cards) cannot nest inside the selectable Text tree. */
function isViewHost(node: ReactNode): node is ReactElement {
  if (!isValidElement(node)) return false;
  return (
    node.type === View ||
    node.type === Pressable ||
    node.type === FilePreviewCard
  );
}

/**
 * List-item bodies may mix inline Text with nested View lists — keep Views
 * as siblings and wrap consecutive text nodes in one Text.
 */
function wrapListItemBody(
  children: ReactNode[],
  textStyle?: TextStyle,
): ReactNode[] {
  const out: ReactNode[] = [];
  let textBuf: ReactNode[] = [];
  const flush = () => {
    if (textBuf.length === 0) return;
    out.push(
      <RNText key={`li-t-${out.length}`} style={textStyle}>
        {textBuf}
      </RNText>,
    );
    textBuf = [];
  };
  for (const child of children) {
    if (isViewHost(child)) {
      flush();
      out.push(child);
    } else if (child != null && child !== false) {
      textBuf.push(child);
    }
  }
  flush();
  return out;
}

type ListToken = NonNullable<ReturnType<MarkedTokenizer["list"]>>;
type ListItemToken = ListToken["items"][number];

// react-native-marked renders a list item from its inline tokens and knows no
// checkbox token, so a task item gets its box folded into the text it owns.
// marked queues inline lexing by value when a token is created, so the folded
// text is queued again into a fresh array, which is the one the parser reads.
const foldTaskBox = (item: ListItemToken, lexer: MarkedTokenizer["lexer"]) => {
  const box = item.checked ? "☑" : "☐";
  const boxIndex = item.tokens.findIndex((token) => token.type === "checkbox");
  const target = item.tokens[boxIndex === -1 ? 0 : boxIndex + 1];
  if (!target || (target.type !== "text" && target.type !== "paragraph")) {
    return;
  }
  const text = `${box} ${target.text.replace(/^\[[ xX]\][ \t]+/, "")}`;
  target.text = text;
  target.raw = text;
  target.tokens = lexer.inline(text, []);
};

export class TaskListTokenizer extends MarkedTokenizer {
  override list(src: string) {
    const list = super.list(src);
    if (list) {
      for (const item of list.items) {
        if (item.task) foldTaskBox(item, this.lexer);
      }
    }
    return list;
  }
}

const taskListTokenizer = new TaskListTokenizer();

/** Preview card for agent `file://` workspace links (matches web canvas). */
function WorkspaceFileCard({ href }: { readonly href: string }) {
  const path = decodeURIComponent(href.replace(/^file:\/\//i, ""));
  return <FilePreviewCard path={path} />;
}

/**
 * Renders only Text-compatible nodes so the whole message can sit under one
 * selectable parent (Text on Android, read-only TextInput on iOS). Native
 * selection cannot cross View boundaries.
 */
class MarkdownRenderer extends Renderer {
  keyIndex = 0;

  constructor(_source: string) {
    // Android Text.selectable; iOS uses UITextView via TextInput instead.
    super({ selectable: Platform.OS !== "ios" });
  }

  override getKey(): string {
    return `md-${this.keyIndex++}`;
  }

  /** Paragraphs are nested Text unless they host a file card (View). */
  override paragraph(children: ReactNode[], styles?: ViewStyle): ReactNode {
    if (children.some(isViewHost)) {
      return (
        <View key={this.getKey()} style={{ gap: 8 }}>
          {wrapListItemBody(children, styles as TextStyle)}
        </View>
      );
    }
    return (
      <RNText key={this.getKey()} style={styles as TextStyle}>
        {children}
      </RNText>
    );
  }

  override listItem(children: ReactNode[], styles?: ViewStyle): ReactNode {
    // flex:1 column beside the marker so wraps hang under the text, not the bullet.
    return (
      <View key={this.getKey()} style={{ flex: 1, minWidth: 0 }}>
        {wrapListItemBody(children, styles as TextStyle)}
      </View>
    );
  }

  override blockquote(children: ReactNode[], styles?: ViewStyle): ReactNode {
    return (
      <RNText key={this.getKey()} style={[{ opacity: 0.9 }, styles as TextStyle]}>
        {children}
      </RNText>
    );
  }

  override hr(styles?: ViewStyle): ReactNode {
    return (
      <RNText key={this.getKey()} style={styles as TextStyle}>
        ———
      </RNText>
    );
  }

  override code(
    text: string,
    _language?: string,
    _containerStyle?: ViewStyle,
    textStyle?: TextStyle,
  ): ReactNode {
    return (
      <RNText
        key={this.getKey()}
        style={[
          // Intentional StyleSheet mono sizing — marked styles, not className.
          { fontFamily: MONOSPACE, fontSize: 13, lineHeight: 20 },
          textStyle,
        ]}
      >
        {text}
      </RNText>
    );
  }

  override image(
    _uri: string,
    alt?: string,
    _style?: object,
    title?: string,
  ): ReactNode {
    const label = (alt || title || "image").trim() || "image";
    return <RNText key={this.getKey()}>{`[${label}]`}</RNText>;
  }

  override linkImage(
    href: string,
    _imageUrl: string,
    alt?: string,
    _style?: object,
    title?: string,
  ): ReactNode {
    const label = (alt || title || "image").trim() || "image";
    return (
      <RNText
        key={this.getKey()}
        accessibilityRole="link"
        onPress={() => openWebUrl(href)}
      >
        {`[${label}]`}
      </RNText>
    );
  }

  override table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    _tableStyle?: ViewStyle,
    _rowStyle?: ViewStyle,
    _cellStyle?: ViewStyle,
  ): ReactNode {
    const lineOf = (cells: ReactNode[][]) =>
      cells.map((cell, index) => (
        <RNText key={`c-${index}`}>
          {index > 0 ? " | " : ""}
          {cell}
        </RNText>
      ));
    return (
      <RNText key={this.getKey()}>
        {lineOf(header)}
        {"\n"}
        {rows.map((row, rowIndex) => (
          <RNText key={`r-${rowIndex}`}>
            {rowIndex > 0 ? "\n" : ""}
            {lineOf(row)}
          </RNText>
        ))}
      </RNText>
    );
  }

  override link(
    children: string | ReactNode[],
    href: string,
    styles?: TextStyle,
    title?: string,
  ): ReactNode {
    const label = linkChildrenToText(children);
    if (/^https?:\/\//i.test(href) && isCitationLabel(label)) {
      const index = label.replace(/^\s*\[|\]\s*$/g, "");
      return (
        <RNText
          key={this.getKey()}
          accessibilityRole="link"
          accessibilityLabel={`Source ${index}`}
          onPress={() => openWebUrl(href)}
          style={[{ fontWeight: "600" }, styles]}
        >
          {`[${index}]`}
        </RNText>
      );
    }
    if (/^https?:\/\//i.test(href)) {
      return (
        <RNText
          key={this.getKey()}
          accessibilityRole="link"
          accessibilityLabel={title || "Link"}
          onPress={() => openWebUrl(href)}
          style={styles}
        >
          {children}
        </RNText>
      );
    }
    if (/^file:\/\//i.test(href)) {
      return <WorkspaceFileCard key={this.getKey()} href={href} />;
    }
    return super.link(children, href, styles, title);
  }

  override list(
    ordered: boolean,
    li: ReactNode[],
    _listStyle?: ViewStyle,
    textStyle?: TextStyle,
    startIndex = 1,
  ): ReactNode {
    const listKey = this.getKey();
    const lastIndex = startIndex + Math.max(li.length, 1) - 1;
    const markerSlot = ordered
      ? Math.max(LIST_MARKER_SLOT, String(lastIndex).length * 10 + 12)
      : LIST_MARKER_SLOT;
    const fontSize =
      typeof textStyle?.fontSize === "number" ? textStyle.fontSize : BODY_SIZE;
    return (
      <View
        key={listKey}
        style={{
          gap: LIST_ITEM_GAP,
          // Indent the whole list (web `ms-5`); marker sits in the leading slot.
          paddingLeft: LIST_INDENT,
        }}
      >
        {li.map((item, index) => (
          <View
            key={`${listKey}-${index}`}
            style={{ flexDirection: "row", alignItems: "flex-start" }}
          >
            <RNText
              style={[
                textStyle,
                {
                  width: markerSlot,
                  textAlign: ordered ? "right" : "left",
                  paddingRight: ordered ? 6 : 8,
                  // Same color as body; bullet scaled to sit with the first line.
                  ...(ordered
                    ? null
                    : {
                        fontSize: Math.round(fontSize * 0.55),
                        lineHeight:
                          typeof textStyle?.lineHeight === "number"
                            ? textStyle.lineHeight
                            : BODY_LINE,
                      }),
                },
              ]}
            >
              {ordered ? `${startIndex + index}.` : LIST_BULLET}
            </RNText>
            {item}
          </View>
        ))}
      </View>
    );
  }
}

const asColor = (value: string | number | undefined) =>
  typeof value === "string" ? value : undefined;

type MarkdownTextVariant = "muted";

// The theme and the variables come from the CSSOM, so they apply from the first render after hydration.
const useMarkdownOptions = (
  variant?: MarkdownTextVariant,
): useMarkdownHookOptions => {
  const hydrated = useHydrated();
  const { theme } = useUniwind();
  const variables = useCSSVariable([
    "--color-foreground",
    "--color-primary",
    "--color-muted",
    "--color-muted-foreground",
    "--color-border",
  ]);
  const [foreground, primary, muted, mutedForeground, border] = hydrated
    ? variables
    : [];
  const colorScheme = hydrated && theme === "dark" ? "dark" : "light";

  return useMemo(() => {
    const text = asColor(variant === "muted" ? mutedForeground : foreground);
    const link = asColor(primary);
    const code = asColor(muted);
    const rule = asColor(border);
    const colors =
      text && link && code && rule
        ? { text, link, code, border: rule }
        : undefined;

    const bodyText =
      variant === "muted"
        ? { fontSize: MUTED_SIZE, lineHeight: MUTED_LINE }
        : { fontSize: BODY_SIZE, lineHeight: BODY_LINE };
    const styles: MarkedStyles = {
      text: bodyText,
      strong: { ...bodyText, fontWeight: "600" },
      em: bodyText,
      strikethrough: bodyText,
      // Spacing between blocks comes from `\n\n` in the selectable tree.
      paragraph: { paddingVertical: 0, marginBottom: 0 },
      li: bodyText,
      list: {},
      link: {
        ...bodyText,
        fontStyle: "normal",
        textDecorationLine: "underline",
      },
      codespan: {
        fontFamily: MONOSPACE,
        fontSize: variant === "muted" ? 13 : 14,
      },
      blockquote: {
        opacity: 0.9,
      },
      hr: {},
      h1: { ...bodyText, fontWeight: "600" },
      h2: { ...bodyText, fontWeight: "600" },
      h3: { ...bodyText, fontWeight: "600" },
      h4: { ...bodyText, fontWeight: "600" },
      h5: { ...bodyText, fontWeight: "600" },
      h6: { ...bodyText, fontWeight: "600" },
      tableCell: {},
    };
    const options: useMarkdownHookOptions = {
      colorScheme,
      styles,
      tokenizer: taskListTokenizer,
    };
    if (colors) options.theme = { colors };
    return options;
  }, [
    variant,
    colorScheme,
    foreground,
    primary,
    muted,
    mutedForeground,
    border,
  ]);
};

type MarkdownTextProps = TextMessagePartProps & {
  variant?: MarkdownTextVariant;
};

function useMarkdownTypeStyle(variant: MarkdownTextVariant | undefined) {
  const hydrated = useHydrated();
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  // muted → body (15); default answer → label (17). Size is pinned on the
  // native style — keep in lockstep with UserText bubbles.
  const fallbackClass =
    variant === "muted"
      ? textVariants({ variant: "body", tone: "muted", includeSize: false })
      : textVariants({ variant: "label", includeSize: false });
  const typeStyle = {
    padding: 0,
    margin: 0,
    fontSize: variant === "muted" ? MUTED_SIZE : BODY_SIZE,
    lineHeight: variant === "muted" ? MUTED_LINE : BODY_LINE,
    ...(hydrated
      ? {
          color:
            variant === "muted"
              ? asColor(mutedForeground)
              : asColor(foreground),
        }
      : null),
  } as const;
  return { fallbackClass, typeStyle } as const;
}

/**
 * Streaming answers paint as plain Text — Marked over the growing buffer on
 * every line boundary freezes the JS thread. Settled messages use the full
 * markdown path. Do not use useDeferredValue here (it blanked the body).
 */
const StreamingMarkdownText: FC<MarkdownTextProps> = ({ text, variant }) => {
  useEffect(() => {
    traceStream("paint", text.length);
  }, [text.length]);
  const { fallbackClass, typeStyle } = useMarkdownTypeStyle(variant);

  if (!text) {
    return <View className="aui-md-root" />;
  }

  return (
    <View className="aui-md-root">
      {Platform.OS === "ios" ? (
        <TextInput
          multiline
          editable={false}
          readOnly
          scrollEnabled={false}
          selectionColor={SELECTION_COLOR}
          style={typeStyle}
          className={fallbackClass}
          value={text}
        />
      ) : (
        <Text
          selectable
          selectionColor={SELECTION_COLOR}
          variant={variant === "muted" ? "body" : "label"}
          tone={variant === "muted" ? "muted" : "default"}
        >
          {text}
        </Text>
      )}
    </View>
  );
};

const SettledMarkdownText: FC<MarkdownTextProps> = ({ text, variant }) => {
  const { fallbackClass, typeStyle } = useMarkdownTypeStyle(variant);
  const baseOptions = useMarkdownOptions(variant);
  const renderer = useMemo(() => new MarkdownRenderer(text), [text]);
  const options = useMemo(
    () => ({ ...baseOptions, renderer }),
    [baseOptions, renderer],
  );
  const elements = useMarkdown(text || " ", options);

  if (!text) {
    return <View className="aui-md-root" />;
  }

  // Each block is its own row with BLOCK_GAP — tighter than joining
  // paragraphs with `\n\n` (a full blank line). List Views stay outside
  // TextInput so hanging indents keep working.
  // iOS Text.selectable is UILabel (whole-block Copy only). Multiline
  // TextInput uses UITextView so partial selection matches native Notes.
  return (
    <View className="aui-md-root" style={{ gap: BLOCK_GAP }}>
      {elements.map((element, index) => {
        if (isViewHost(element)) {
          return <Fragment key={`md-v-${index}`}>{element}</Fragment>;
        }
        if (Platform.OS === "ios") {
          return (
            <TextInput
              key={`md-t-${index}`}
              multiline
              editable={false}
              readOnly
              scrollEnabled={false}
              selectionColor={SELECTION_COLOR}
              style={typeStyle}
              className={fallbackClass}
            >
              {element}
            </TextInput>
          );
        }
        return (
          <Text
            key={`md-t-${index}`}
            selectable
            selectionColor={SELECTION_COLOR}
            variant={variant === "muted" ? "body" : "label"}
            tone={variant === "muted" ? "muted" : "default"}
          >
            {element}
          </Text>
        );
      })}
    </View>
  );
};

const MarkdownTextImpl: FC<MarkdownTextProps> = (props) => {
  const streaming = (props.status?.type ?? "running") === "running";
  return streaming ? (
    <StreamingMarkdownText {...props} />
  ) : (
    <SettledMarkdownText {...props} />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
