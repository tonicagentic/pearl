import { useMemo, type ComponentProps, type ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useAuiState } from "@assistant-ui/react-native";

import { cn } from "@/lib/utils";
import { threadMeta } from "./surfaces";

export type CitationRef = {
  readonly index: string;
  readonly url: string;
  readonly title?: string;
};

const CITATION_LINK_RE =
  /\[(\d+)\]\((https?:\/\/[^\s)]+)(?:\s+"([^"]*)")?\)/g;

/** Pull numbered markdown citations `[1](https://…)` out of assistant text. */
export function extractCitationRefs(markdown: string): CitationRef[] {
  const seen = new Set<string>();
  const refs: CitationRef[] = [];

  for (const match of markdown.matchAll(CITATION_LINK_RE)) {
    const index = match[1];
    const url = match[2];
    const title = match[3]?.trim() || undefined;
    if (!index || !url || seen.has(index)) continue;
    seen.add(index);
    refs.push(title ? { index, url, title } : { index, url });
  }

  return refs.sort((a, b) => Number(a.index) - Number(b.index));
}

/** True when a markdown link label is a bare citation number like `1` or `[1]`. */
export function isCitationLabel(text: string): boolean {
  return /^\s*\[?\d+\]?\s*$/.test(text);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => {});
}

export function CitationChip({
  index,
  href,
  title,
  className,
}: {
  readonly index: string;
  readonly href: string;
  readonly title?: string;
  readonly className?: string;
}) {
  const label = index.replace(/^\s*\[|\]\s*$/g, "");
  const displayTitle = title?.trim() || hostnameOf(href);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Source ${label}: ${displayTitle}`}
      hitSlop={6}
      onPress={() => openUrl(href)}
      className={cn(
        "bg-muted ms-0.5 h-4 min-w-4 items-center justify-center rounded px-1 active:opacity-70",
        className,
      )}
    >
      <Text className="text-muted-foreground text-[11px] leading-none font-medium tabular-nums">
        {label}
      </Text>
    </Pressable>
  );
}

const EMPTY_CITATION_REFS: readonly CitationRef[] = [];

/**
 * Compact sources row under an assistant message when the reply contains
 * numbered citations. Hidden when nothing was cited.
 */
export function MessageSources({ className }: ComponentProps<typeof View>) {
  // Select a primitive snapshot (string). Returning a fresh array from
  // useAuiState trips React's getSnapshot caching check and loops.
  const markdown = useAuiState((s) => {
    if (s.message.role !== "assistant") return "";
    return s.message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter((text) => text.length > 0)
      .join("\n");
  });

  const refs = useMemo(() => {
    if (!markdown) return EMPTY_CITATION_REFS;
    return extractCitationRefs(markdown);
  }, [markdown]);

  if (refs.length === 0) return null;

  return (
    <View
      data-slot="message-sources"
      className={cn("flex-col gap-1.5 pt-1", className)}
    >
      <Text className={cn(threadMeta, "font-medium")}>Sources</Text>
      <View className="flex-col gap-1">
        {refs.map((ref) => (
          <View key={ref.index} className="min-w-0 flex-row items-baseline gap-2">
            <View className="bg-muted h-4 min-w-4 shrink-0 items-center justify-center rounded px-1">
              <Text className="text-muted-foreground text-[11px] leading-none font-medium tabular-nums">
                {ref.index}
              </Text>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={ref.title ?? ref.url}
              onPress={() => openUrl(ref.url)}
              className="min-w-0 flex-1 active:opacity-70"
            >
              <Text className={cn(threadMeta)} numberOfLines={1}>
                {ref.title?.trim() || hostnameOf(ref.url)}
                <Text className="text-muted-foreground/70">
                  {" "}
                  · {hostnameOf(ref.url)}
                </Text>
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Flatten react-native-marked link children to plain text for citation detection. */
export function linkChildrenToText(
  children: string | ReactNode[],
): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (
        child &&
        typeof child === "object" &&
        "props" in child &&
        child.props &&
        typeof child.props === "object" &&
        "children" in child.props
      ) {
        const nested = (child.props as { children?: unknown }).children;
        if (typeof nested === "string" || typeof nested === "number") {
          return String(nested);
        }
        if (Array.isArray(nested)) return linkChildrenToText(nested);
      }
      return "";
    })
    .join("");
}
