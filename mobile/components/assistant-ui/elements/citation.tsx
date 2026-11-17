import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useAuiState } from "@assistant-ui/react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { openWebUrl } from "@/src/open-web-url";
import { stepEnter, threadMeta, useMotion } from "./surfaces";

/** Portal to document.body on Expo web only — avoid pulling react-dom into native. */
function portalToBody(node: ReactNode): ReactNode {
  if (Platform.OS !== "web" || typeof document === "undefined") return node;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- web-only
  const { createPortal } = require("react-dom") as typeof import("react-dom");
  return createPortal(node, document.body);
}

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

export function normalizeCitationIndex(index: string): string {
  return index.replace(/^\s*\[|\]\s*$/g, "");
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
}

function FaviconMark({
  hostname,
  size = 16,
}: {
  readonly hostname: string;
  readonly size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (hostname.charAt(0) || "?").toUpperCase();

  if (failed) {
    return (
      <View
        className="bg-muted items-center justify-center rounded"
        style={{ width: size, height: size }}
      >
        <Text
          variant="caption"
          weight="medium"
          className="leading-none"
          style={{ fontSize: Math.max(9, size * 0.55) }}
        >
          {letter}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: faviconUrl(hostname) }}
      accessibilityIgnoresInvertColors
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: 3 }}
    />
  );
}

function CitationPreviewCard({
  href,
  title,
  onOpen,
}: {
  readonly href: string;
  readonly title?: string;
  readonly onOpen: () => void;
}) {
  const host = hostnameOf(href);
  const displayTitle = title?.trim() || host;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${displayTitle}, ${host}`}
      onPress={onOpen}
      className="flex-row gap-3 rounded-md active:opacity-80"
    >
      <FaviconMark hostname={host} size={20} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" weight="medium" numberOfLines={2}>
          {displayTitle}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {host}
        </Text>
      </View>
    </Pressable>
  );
}

function CitationPeekBody({
  href,
  title,
  displayTitle,
  onDismiss,
  onOpen,
  constrainWidth,
}: {
  readonly href: string;
  readonly title?: string;
  readonly displayTitle: string;
  readonly onDismiss: () => void;
  readonly onOpen: () => void;
  /** Expo web portals to body — keep the sheet phone-width, not full desktop. */
  readonly constrainWidth?: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-1 justify-end bg-black/40 pt-24",
        constrainWidth ? "items-center" : undefined,
      )}
    >
      <Pressable
        accessibilityLabel="Dismiss citation preview"
        onPress={onDismiss}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        className={cn(
          "px-4 pb-10",
          constrainWidth ? "w-full max-w-[390px]" : "w-full",
        )}
      >
        <View className="border-border bg-card rounded-2xl border p-4 shadow-lg">
          <CitationPreviewCard href={href} title={title} onOpen={onOpen} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${displayTitle}`}
            onPress={onOpen}
            className="bg-foreground/8 mt-3 items-center rounded-xl py-2.5 active:opacity-80"
          >
            <Text variant="secondary" weight="medium">
              Open source
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * RN Modal on Expo web lands as position:relative in-flow and blows out the
 * thread. Portal a fixed overlay on web; keep Modal on native.
 */
function CitationPeek({
  open,
  href,
  title,
  displayTitle,
  onDismiss,
  onOpen,
}: {
  readonly open: boolean;
  readonly href: string;
  readonly title?: string;
  readonly displayTitle: string;
  readonly onDismiss: () => void;
  readonly onOpen: () => void;
}) {
  if (!open) return null;

  const body = (
    <CitationPeekBody
      href={href}
      title={title}
      displayTitle={displayTitle}
      onDismiss={onDismiss}
      onOpen={onOpen}
      constrainWidth={Platform.OS === "web"}
    />
  );

  if (Platform.OS === "web") {
    return portalToBody(
      <View accessibilityViewIsModal style={webPeekOverlayStyle}>
        {body}
      </View>,
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {body}
    </Modal>
  );
}

const webPeekOverlayStyle = {
  position: "fixed" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 9999,
};

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
  const label = normalizeCitationIndex(index);
  const displayTitle = title?.trim() || hostnameOf(href);
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => setOpen(false), []);
  const openSource = useCallback(() => {
    setOpen(false);
    openWebUrl(href);
  }, [href]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Source ${label}: ${displayTitle}`}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen((prev) => !prev)}
        className={cn(
          // inline-flex keeps the chip in the markdown text run on Expo web
          "bg-muted ms-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 align-super active:opacity-70",
          open && "opacity-90",
          className,
        )}
      >
        <Text
          variant="caption"
          weight="medium"
          className="leading-none tabular-nums"
        >
          {label}
        </Text>
      </Pressable>
      <CitationPeek
        open={open}
        href={href}
        title={title}
        displayTitle={displayTitle}
        onDismiss={dismiss}
        onOpen={openSource}
      />
    </>
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
  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";

  if (refs.length === 0) return null;

  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      data-slot="message-sources"
      className={cn("flex-col gap-1.5 pt-1", className)}
    >
      <Text variant="body" weight="medium" className={threadMeta}>
        Sources
      </Text>
      <View className="flex-col gap-1.5">
        {refs.map((ref) => {
          const host = hostnameOf(ref.url);
          const displayTitle = ref.title?.trim() || host;
          return (
            <View
              key={ref.index}
              className="min-w-0 flex-row items-center gap-2"
            >
              <View className="bg-muted h-4 min-w-4 shrink-0 items-center justify-center rounded px-1">
                <Text
                  variant="caption"
                  weight="medium"
                  className="leading-none tabular-nums"
                >
                  {ref.index}
                </Text>
              </View>
              <FaviconMark hostname={host} size={14} />
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={ref.title ?? ref.url}
                onPress={() => openWebUrl(ref.url)}
                className="min-w-0 flex-1 active:opacity-70"
              >
                <Text variant="body" className={threadMeta} numberOfLines={1}>
                  {displayTitle}
                  <Text variant="body" tone="muted" className="opacity-70">
                    {" "}
                    · {host}
                  </Text>
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Animated.View>
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
