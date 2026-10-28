import { useHydrated } from "@/components/assistant-ui/elements/surfaces";
import {
  CitationChip,
  isCitationLabel,
  linkChildrenToText,
} from "@/components/assistant-ui/elements/citation";
import { Icon } from "@/components/ui/icon";
import type { TextMessagePartProps } from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import { CheckIcon, CopyIcon } from "lucide-react-native";
import {
  type FC,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
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

// Show wire text as it arrives (no client typewriter). A paced reveal +
// setState sync lagged behind eve and hit "Maximum update depth exceeded",
// which aborted the store as "Connection interrupted".
const useStreamedText = (text: string): string => text;

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
    styles?: import("react-native").TextStyle,
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
    return super.link(children, href, styles, title);
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
        ? { fontSize: 15, lineHeight: 24 }
        : { fontSize: 15, lineHeight: 24 };
    const styles: MarkedStyles = {
      text: bodyText,
      paragraph: { paddingVertical: 6 },
      li: { ...bodyText, paddingVertical: 2 },
      list: { paddingVertical: 6, paddingLeft: 4 },
      link: { fontStyle: "normal", textDecorationLine: "underline" },
      codespan: {
        fontFamily: MONOSPACE,
        fontSize: 14,
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
        fontSize: 15,
        lineHeight: 24,
        fontWeight: "600",
        marginTop: 20,
        marginBottom: 8,
        paddingBottom: 0,
        borderBottomWidth: 0,
      },
      h2: {
        fontSize: 15,
        lineHeight: 24,
        fontWeight: "600",
        marginTop: 18,
        marginBottom: 6,
        paddingBottom: 0,
        borderBottomWidth: 0,
      },
      h3: {
        fontSize: 15,
        lineHeight: 24,
        fontWeight: "600",
        marginTop: 16,
        marginBottom: 6,
      },
      h4: {
        fontSize: 15,
        lineHeight: 24,
        fontWeight: "600",
        marginTop: 14,
        marginBottom: 4,
      },
      h5: {
        fontSize: 15,
        lineHeight: 24,
        fontWeight: "600",
        marginTop: 12,
        marginBottom: 4,
      },
      h6: {
        fontSize: 15,
        lineHeight: 24,
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
  const displayedText = useStreamedText(text);
  const options = useMarkdownOptions(variant);
  // Re-lexing markdown on every token stalls the JS thread behind a healthy
  // wire stream. While running, paint plain text; markdown after the part settles.
  const blocks = useMemo(() => {
    if (streaming) return null;
    return MarkedLexer(displayedText, { gfm: true }).filter(
      (token) => token.type !== "space",
    );
  }, [displayedText, streaming]);

  if (streaming) {
    return (
      <View className="aui-md-root">
        <Text selectable className="text-foreground text-[15px] leading-6">
          {displayedText}
        </Text>
      </View>
    );
  }

  return (
    <View className="aui-md-root">
      {(blocks ?? []).map((token, index) => (
        <MarkdownBlock key={index} raw={token.raw} options={options} />
      ))}
    </View>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
