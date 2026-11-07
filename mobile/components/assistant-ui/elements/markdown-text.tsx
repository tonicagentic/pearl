import { useHydrated } from "@/components/assistant-ui/elements/surfaces";
import {
  CitationChip,
  isCitationLabel,
  linkChildrenToText,
} from "@/components/assistant-ui/elements/citation";
import { Icon } from "@/components/ui/icon";
import { openWebUrl } from "@/src/open-web-url";
import type { TextMessagePartProps } from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import { CheckIcon, CopyIcon } from "lucide-react-native";
import {
  type FC,
  isValidElement,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import {
  MarkedLexer,
  type MarkedStyles,
  MarkedTokenizer,
  Renderer,
  useMarkdown,
  type useMarkdownHookOptions,
} from "react-native-marked";
import { useCSSVariable, useUniwind } from "uniwind";

const MONOSPACE = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const BODY_SIZE = 17;
const BODY_LINE = 26;
const MUTED_SIZE = 15;
const MUTED_LINE = 24;
const MARKER_COL = 24;
const DISC_SIZE = 6;
const STREAM_PARSE_MS = 80;
const TASK_BOX_RE = /^[☑☐]/;

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

// One-way throttle: props → local state only. Writing back into the message
// store previously hit "Maximum update depth exceeded". Leading edge paints
// the first chunk immediately; later chunks coalesce on ~80ms.
const useThrottledMarkdownText = (text: string, streaming: boolean): string => {
  const [parsedText, setParsedText] = useState(text);
  const pendingRef = useRef(text);
  const lastFlushRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    pendingRef.current = text;
    if (!streaming) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
      lastFlushRef.current = 0;
      setParsedText(text);
      return;
    }
    const now = Date.now();
    const elapsed = now - lastFlushRef.current;
    if (elapsed >= STREAM_PARSE_MS) {
      lastFlushRef.current = now;
      setParsedText(text);
      return;
    }
    if (timerRef.current !== undefined) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      lastFlushRef.current = Date.now();
      setParsedText(pendingRef.current);
    }, STREAM_PARSE_MS - elapsed);
  }, [text, streaming]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  return parsedText;
};

const firstTextContent = (node: ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const child of node) {
      const text = firstTextContent(child);
      if (text) return text;
    }
    return "";
  }
  if (isValidElement(node)) {
    return firstTextContent(
      (node.props as { children?: ReactNode }).children,
    );
  }
  return "";
};

const CodeBlock: FC<{ code: string; language: string | undefined }> = ({
  code,
  language,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearTimeout(resetTimerRef.current);
      setIsCopied(false);
    };
  }, []);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      return;
    }
    if (unmountedRef.current) return;
    setIsCopied(true);
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <View className="aui-md-code-block border-border bg-muted/50 my-2 overflow-hidden rounded-xl border">
      <View className="aui-md-code-header border-border/50 flex-row items-center justify-between border-b py-1 pr-1 pl-3.5">
        <Text className="text-muted-foreground text-xs font-medium lowercase">
          {language || "text"}
        </Text>
        <Pressable
          onPress={copy}
          className="active:bg-muted size-7 items-center justify-center rounded-md"
          accessibilityRole="button"
          accessibilityLabel="Copy code"
        >
          <Icon
            as={isCopied ? CheckIcon : CopyIcon}
            className="text-muted-foreground size-4"
          />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-3.5 py-3"
      >
        <Text
          selectable
          className="text-foreground text-[13px] leading-5"
          style={{ fontFamily: MONOSPACE }}
        >
          {code}
        </Text>
      </ScrollView>
    </View>
  );
};

// One renderer per parse: the constructor takes the text it renders so the
// memo that creates it stays keyed on that text under React Compiler, and the
// key ordinal restarts with each instance.
class MarkdownRenderer extends Renderer {
  keyIndex = 0;

  constructor(_source: string) {
    // Custom renderer ignores Markdown's selectable prop; set it here.
    super({ selectable: true });
  }

  override getKey(): string {
    return `md-${this.keyIndex++}`;
  }

  override code(text: string, language?: string): ReactNode {
    return <CodeBlock key={this.getKey()} code={text} language={language} />;
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
          title={title?.trim() || undefined}
        />
      );
    }
    // Keep http(s) links in-app; react-native-marked's default opens Safari.
    if (/^https?:\/\//i.test(href)) {
      return (
        <Text
          key={this.getKey()}
          selectable
          accessibilityRole="link"
          accessibilityLabel={title || "Link"}
          onPress={() => openWebUrl(href)}
          style={styles}
        >
          {children}
        </Text>
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
    const lineHeight =
      typeof textStyle?.lineHeight === "number"
        ? textStyle.lineHeight
        : BODY_LINE;
    const fontSize =
      typeof textStyle?.fontSize === "number" ? textStyle.fontSize : BODY_SIZE;

    return (
      <View key={listKey} style={{ marginVertical: 4 }}>
        {li.map((item, index) => {
          const isTask = TASK_BOX_RE.test(firstTextContent(item).trimStart());
          return (
            <View
              key={`${listKey}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: MARKER_COL,
                  height: lineHeight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ordered ? (
                  <Text
                    style={{
                      color: textStyle?.color,
                      fontSize,
                      lineHeight,
                      textAlign: "right",
                      width: MARKER_COL,
                    }}
                  >
                    {`${startIndex + index}.`}
                  </Text>
                ) : isTask ? null : (
                  <View
                    className="bg-foreground rounded-full"
                    style={{ width: DISC_SIZE, height: DISC_SIZE }}
                  />
                )}
              </View>
              <View style={{ flex: 1, flexShrink: 1 }}>{item}</View>
            </View>
          );
        })}
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
      paragraph: { paddingVertical: 0, marginBottom: 14 },
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
        borderRadius: 4,
        paddingHorizontal: 4,
      },
      blockquote: {
        borderLeftWidth: 2,
        paddingLeft: 12,
        marginVertical: 8,
        opacity: 1,
      },
      hr: { height: 1, marginVertical: 16, borderWidth: 0 },
      h1: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 20,
        marginBottom: 8,
        paddingBottom: 0,
        borderBottomWidth: 0,
      },
      h2: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 18,
        marginBottom: 6,
        paddingBottom: 0,
        borderBottomWidth: 0,
      },
      h3: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 16,
        marginBottom: 6,
      },
      h4: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 14,
        marginBottom: 4,
      },
      h5: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 12,
        marginBottom: 4,
      },
      h6: {
        ...bodyText,
        fontWeight: "600",
        marginTop: 12,
        marginBottom: 4,
      },
      tableCell: { paddingHorizontal: 8, paddingVertical: 6 },
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

// Each top-level block is re-lexed on its own, so a streaming update re-renders
// only the block it touched; reference-style link definitions therefore do not
// resolve across blocks.
const MarkdownBlock = memo(
  ({ raw, options }: { raw: string; options: useMarkdownHookOptions }) => {
    // A fresh renderer per parse keeps keys unique among siblings and identical
    // across the re-parses of a streaming block instead of remounting it.
    const renderer = useMemo(() => new MarkdownRenderer(raw), [raw]);
    const blockOptions = useMemo(
      () => ({ ...options, renderer }),
      [options, renderer],
    );
    const elements = useMarkdown(raw, blockOptions);
    return <>{elements}</>;
  },
);
MarkdownBlock.displayName = "MarkdownBlock";

type MarkdownTextProps = TextMessagePartProps & {
  variant?: MarkdownTextVariant;
};

const MarkdownTextImpl: FC<MarkdownTextProps> = ({ text, status, variant }) => {
  const statusType = status?.type ?? "running";
  const streaming = statusType === "running";
  const displayedText = useThrottledMarkdownText(text, streaming);
  const options = useMarkdownOptions(variant);
  const fallbackClass =
    variant === "muted"
      ? "text-muted-foreground text-[15px] leading-6"
      : "text-foreground text-[17px] leading-[26px]";

  // Re-lexing every wire token stalls the JS thread; the throttle above keeps
  // markdown current without parsing on each chunk.
  const blocks = useMemo(() => {
    if (!displayedText) return [];
    try {
      return MarkedLexer(displayedText, { gfm: true }).filter(
        (token) => token.type !== "space",
      );
    } catch {
      return null;
    }
  }, [displayedText]);

  if (blocks === null) {
    return (
      <View className="aui-md-root">
        <Text selectable className={fallbackClass}>
          {displayedText}
        </Text>
      </View>
    );
  }

  return (
    <View className="aui-md-root">
      {blocks.map((token, index) => (
        <MarkdownBlock key={index} raw={token.raw} options={options} />
      ))}
    </View>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
