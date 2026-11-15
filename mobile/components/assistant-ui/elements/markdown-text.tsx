import { useHydrated } from "@/components/assistant-ui/elements/surfaces";
import {
  isCitationLabel,
  linkChildrenToText,
} from "@/components/assistant-ui/elements/citation";
import { openWebUrl } from "@/src/open-web-url";
import { useWorkspaceOptional } from "@/src/workspace-context";
import { traceStream } from "@/src/stream-trace";
import type { TextMessagePartProps } from "@assistant-ui/react-native";
import {
  type FC,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  Platform,
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

/** Count single `*` markers that are not part of `**` (Hermes-safe). */
function oddSingleAsterisks(text: string): boolean {
  let singles = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "*") continue;
    if (text[i + 1] === "*") {
      i += 1;
      continue;
    }
    singles += 1;
  }
  return (singles & 1) === 1;
}

/**
 * Mid-stream the model often has an open `**` / `` ` ``. Closing those for
 * display keeps Pearl painting rendered markdown instead of raw markers.
 */
function stabilizeStreamingMarkdown(text: string): string {
  let out = text;
  if (((out.match(/\*\*/g) ?? []).length & 1) === 1) out += "**";
  if (oddSingleAsterisks(out)) out += "*";
  if (((out.match(/__/g) ?? []).length & 1) === 1) out += "__";
  if (((out.match(/`/g) ?? []).length & 1) === 1) out += "`";
  // Unclosed fence: hide the incomplete fence rather than dump ```.
  const fences = out.match(/^```/gm)?.length ?? 0;
  if (fences & 1) {
    const last = out.lastIndexOf("```");
    if (last >= 0) out = out.slice(0, last).replace(/\s+$/, "");
  }
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

/** In-app opener for agent `file://` workspace links (matches web canvas). */
function WorkspaceFileLink({
  href,
  children,
  styles,
  title,
}: {
  readonly href: string;
  readonly children: string | ReactNode[];
  readonly styles?: TextStyle;
  readonly title?: string;
}) {
  const workspace = useWorkspaceOptional();
  const path = decodeURIComponent(href.replace(/^file:\/\//i, ""));

  return (
    <RNText
      accessibilityRole="link"
      accessibilityLabel={title || `Open ${path}`}
      onPress={() => {
        void workspace?.openPath(path);
      }}
      style={styles}
    >
      {children}
    </RNText>
  );
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

  /** Paragraphs are nested Text, not Views — required for cross-block select. */
  override paragraph(children: ReactNode[], styles?: ViewStyle): ReactNode {
    return (
      <RNText key={this.getKey()} style={styles as TextStyle}>
        {children}
      </RNText>
    );
  }

  override listItem(children: ReactNode[], styles?: ViewStyle): ReactNode {
    return (
      <RNText key={this.getKey()} style={styles as TextStyle}>
        {children}
      </RNText>
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
      return (
        <WorkspaceFileLink
          key={this.getKey()}
          href={href}
          styles={styles}
          title={title?.trim() || undefined}
        >
          {children}
        </WorkspaceFileLink>
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
    return (
      <RNText key={listKey} style={textStyle}>
        {li.map((item, index) => (
          <RNText key={`${listKey}-${index}`}>
            {index > 0 ? "\n" : ""}
            {ordered ? `${startIndex + index}. ` : "• "}
            {item}
          </RNText>
        ))}
      </RNText>
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

const MarkdownTextImpl: FC<MarkdownTextProps> = ({ text, status, variant }) => {
  const statusType = status?.type ?? "running";
  const streaming = statusType === "running";
  // Paint wire text directly — setState throttles nested under
  // NotificationManager hit max update depth; useDeferredValue starved
  // and left the body blank until settle.
  useEffect(() => {
    if (!streaming) return;
    traceStream("paint", text.length);
  }, [streaming, text.length]);
  // Close odd markers mid-stream so Marked can bold instead of showing `**`.
  const displayText = useMemo(
    () => (streaming ? stabilizeStreamingMarkdown(text) : text),
    [text, streaming],
  );
  const baseOptions = useMarkdownOptions(variant);
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

  // One renderer + one parse for the full message so selection can span
  // paragraphs, lists, and code as a single native range.
  const renderer = useMemo(
    () => new MarkdownRenderer(displayText),
    [displayText],
  );
  const options = useMemo(
    () => ({ ...baseOptions, renderer }),
    [baseOptions, renderer],
  );
  const elements = useMarkdown(displayText || " ", options);

  if (!displayText) {
    return <View className="aui-md-root" />;
  }

  const document = elements.flatMap((element, index) =>
    index === 0 ? [element] : ["\n\n", element],
  );

  // iOS Text.selectable is UILabel (whole-block Copy only). Multiline
  // TextInput uses UITextView so partial selection matches native Notes.
  if (Platform.OS === "ios") {
    return (
      <View className="aui-md-root">
        <TextInput
          multiline
          editable={false}
          readOnly
          scrollEnabled={false}
          selectionColor={SELECTION_COLOR}
          style={typeStyle}
          className={fallbackClass}
        >
          {document}
        </TextInput>
      </View>
    );
  }

  return (
    <View className="aui-md-root">
      <Text
        selectable
        selectionColor={SELECTION_COLOR}
        variant={variant === "muted" ? "body" : "label"}
        tone={variant === "muted" ? "muted" : "default"}
      >
        {document}
      </Text>
    </View>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
