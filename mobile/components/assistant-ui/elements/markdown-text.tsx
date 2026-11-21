import {
  STREAM_EASE,
  STREAM_FADE_MS,
  useHydrated,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";
import {
  CitationChip,
  isCitationLabel,
  linkChildrenToText,
} from "@/components/assistant-ui/elements/citation";
import { FilePreviewCard } from "@/components/assistant-ui/elements/file-preview-card";
import {
  WorkspaceSvgPreview,
  isWorkspaceSvgPath,
} from "@/components/assistant-ui/elements/workspace-svg-preview";
import { openWebUrl } from "@/src/open-web-url";
import { traceStream } from "@/src/stream-trace";
import {
  useStreamingReveal,
  type StreamingReveal,
} from "../../../../lib/streaming-text-reveal";
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
  useRef,
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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
    node.type === FilePreviewCard ||
    node.type === WorkspaceSvgPreview
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
function WorkspaceFileCard({
  href,
  label,
}: {
  readonly href: string;
  readonly label?: string;
}) {
  const path = decodeURIComponent(href.replace(/^file:\/\//i, ""));
  if (isWorkspaceSvgPath(path)) {
    return <WorkspaceSvgPreview path={path} label={label || path} />;
  }
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
      return (
        <CitationChip
          key={this.getKey()}
          index={label}
          href={href}
          title={title}
        />
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
      return (
        <WorkspaceFileCard
          key={this.getKey()}
          href={href}
          label={label || undefined}
        />
      );
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

/** Dot cursor — mirrors StreamingText's st-pulse; nested Text (not View). */
function StreamingDotCursor({ style }: { readonly style: TextStyle }) {
  const motion = useMotion();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    if (!motion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [motion, pulse]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));
  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[style, { fontSize: 7, lineHeight: style.lineHeight }, animatedStyle]}
    >
      {" ●"}
    </Animated.Text>
  );
}

/**
 * Desktop `st-fade`: opacity 0→1 + light rise (blur approximated — RN Text
 * filter support is uneven). Nested inside a parent Text so wrapping matches
 * web's continuous markdown flow instead of flex-wrap chips.
 */
function StreamingWord({
  word,
  style,
  fade,
}: {
  readonly word: string;
  readonly style: TextStyle;
  readonly fade: boolean;
}) {
  const progress = useSharedValue(fade ? 0 : 1);
  useEffect(() => {
    if (!fade) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: STREAM_FADE_MS,
      easing: STREAM_EASE,
    });
  }, [fade, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 3 }],
  }));
  if (!fade) {
    return <RNText style={style}>{word}</RNText>;
  }
  return <Animated.Text style={[style, animatedStyle]}>{word}</Animated.Text>;
}

/**
 * Marked leaf text → per-word st-fade for the paced tail (desktop StreamingText).
 * Word indices are stable as the visible prefix grows so earlier words do not
 * remount/re-fade on every delta.
 */
class StreamingMarkdownRenderer extends MarkdownRenderer {
  wordIndex = 0;
  fadeFromWord = 0;
  motion = false;

  beginPaint(fadeFromWord: number, motion: boolean) {
    this.keyIndex = 0;
    this.wordIndex = 0;
    this.fadeFromWord = fadeFromWord;
    this.motion = motion;
  }

  override text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (typeof text !== "string") {
      return super.text(text, styles);
    }
    if (!text) return null;
    const style = (styles ?? {}) as TextStyle;
    const nodes: ReactNode[] = [];
    const re = /\S+\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const idx = this.wordIndex++;
      nodes.push(
        <StreamingWord
          key={`sw-${idx}`}
          word={m[0]}
          style={style}
          fade={this.motion && idx >= this.fadeFromWord}
        />,
      );
    }
    if (nodes.length === 0) {
      return <RNText key={this.getKey()} style={style}>{text}</RNText>;
    }
    return (
      <RNText key={this.getKey()} style={style}>
        {nodes}
      </RNText>
    );
  }
}

/**
 * Close dangling inline markers so Marked can paint bold/code while the
 * model is mid-token (avoids flashing raw `**` during the paced reveal).
 */
function stabilizeStreamingMarkdown(src: string): string {
  let s = src;
  // Unclosed fence — show body as plain until the closer lands.
  const fence = "```";
  const fenceCount = s.split(fence).length - 1;
  if (fenceCount % 2 === 1) {
    s += `\n${fence}`;
  }
  const ticks = (s.match(/`/g) || []).length;
  if (ticks % 2 === 1) s += "`";
  const bolds = (s.match(/\*\*/g) || []).length;
  if (bolds % 2 === 1) s += "**";
  return s;
}

/**
 * Streaming answers: Marked on the revealed prefix (desktop StreamingMarkdownText)
 * with per-word st-fade on the paced tail. Settled messages keep selectable Marked.
 */
const StreamingMarkdownText: FC<
  MarkdownTextProps & {
    readonly reveal: StreamingReveal;
    /** False for transcript hydrate — no per-word st-fade replay. */
    readonly animateFade: boolean;
  }
> = ({ text, variant, reveal, animateFade }) => {
  useEffect(() => {
    traceStream("paint", text.length);
  }, [text.length]);
  const { typeStyle } = useMarkdownTypeStyle(variant);
  const motion = useMotion();
  const baseOptions = useMarkdownOptions(variant);
  const { revealed, clip, writing, fadeFromWord } = reveal;

  // Partial last word via clip — matches StreamingText smoother.
  const displayText = stabilizeStreamingMarkdown(
    clip > 0 ? text.slice(0, clip) : text.slice(0, revealed),
  );

  const rendererRef = useRef<StreamingMarkdownRenderer | null>(null);
  if (!rendererRef.current) {
    rendererRef.current = new StreamingMarkdownRenderer(displayText);
  }
  rendererRef.current.beginPaint(
    fadeFromWord,
    Boolean(motion && animateFade),
  );

  const options = useMemo(
    () => ({ ...baseOptions, renderer: rendererRef.current! }),
    [baseOptions],
  );
  const elements = useMarkdown(displayText || " ", options);

  if (!text && !writing) {
    return <View className="aui-md-root" />;
  }

  const wordStyle = {
    fontSize: typeStyle.fontSize,
    lineHeight: typeStyle.lineHeight,
    color: typeStyle.color ?? "#0d0d0d",
  } as TextStyle;

  return (
    <View
      className="aui-md-root"
      style={{ gap: BLOCK_GAP }}
      accessibilityState={{ busy: writing }}
    >
      {displayText
        ? elements.map((element, index) => {
            if (isViewHost(element)) {
              return <Fragment key={`md-v-${index}`}>{element}</Fragment>;
            }
            return (
              <RNText key={`md-t-${index}`} style={typeStyle}>
                {element}
              </RNText>
            );
          })
        : null}
      {writing ? (
        <RNText style={wordStyle}>
          <StreamingDotCursor style={wordStyle} />
        </RNText>
      ) : null}
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
  // Only an explicit running status paces/fades. Missing status is settled
  // (history hydrate / parts without state) — defaulting to running made
  // reopened threads replay word-by-word. Live rows pass status running.
  const turnStreaming = props.status?.type === "running";
  const reveal = useStreamingReveal(props.text, turnStreaming);
  // Fade only while the turn is live and new words are still arriving —
  // opening a previous thread must not replay st-fade through stored text.
  const animateFade =
    turnStreaming && reveal.fadeFromWord < reveal.visibleCount;
  // Keep the paced Marked path until the smoother catches up — then hand off
  // to selectable settled Marked without a whole-reply FadeIn dump.
  if (turnStreaming || reveal.writing) {
    return (
      <StreamingMarkdownText
        {...props}
        reveal={reveal}
        animateFade={animateFade}
      />
    );
  }
  return <SettledMarkdownText {...props} />;
};

export const MarkdownText = memo(MarkdownTextImpl);
