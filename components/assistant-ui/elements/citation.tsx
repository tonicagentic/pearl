"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useOptionalCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { cn } from "@/lib/utils";
import { stepEnter, threadMeta, threadText } from "./surfaces";

function useOpenInCanvasBrowser() {
  const canvas = useOptionalCanvas();
  return useCallback(
    (href: string, event?: { preventDefault: () => void }) => {
      if (!canvas) return false;
      event?.preventDefault();
      canvas.openBrowserUrl(href);
      return true;
    },
    [canvas],
  );
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

export function childrenToPlainText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenToPlainText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return childrenToPlainText(children.props.children);
  }
  return "";
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

/** Soft-fail favicon URL (Google s2). On error, callers show a letter fallback. */
export function faviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
}

type CitationInteractionValue = {
  readonly activeIndex: string | null;
  readonly setActiveIndex: (index: string | null) => void;
};

const CitationInteractionContext = createContext<CitationInteractionValue>({
  activeIndex: null,
  setActiveIndex: () => {},
});

/** Tracks which citation peek is open so claim spans can tint. */
export function CitationInteractionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState<string | null>(null);
  const value = useMemo(
    () => ({ activeIndex, setActiveIndex }),
    [activeIndex],
  );
  return (
    <CitationInteractionContext.Provider value={value}>
      {children}
    </CitationInteractionContext.Provider>
  );
}

export function useCitationActiveIndex(): string | null {
  return useContext(CitationInteractionContext).activeIndex;
}

function useSetCitationActiveIndex() {
  return useContext(CitationInteractionContext).setActiveIndex;
}

/** Preceding claim text for a citation — tints while that chip's peek is open. */
export function CitationClaim({
  index,
  children,
}: {
  readonly index: string;
  readonly children: ReactNode;
}) {
  const label = normalizeCitationIndex(index);
  const active = useCitationActiveIndex();
  return (
    <span
      data-citation-claim={label}
      className={cn(
        "rounded-[3px] transition-colors duration-150 ease-out motion-reduce:transition-none",
        active === label && "bg-sky-500/15 dark:bg-sky-400/20",
      )}
    >
      {children}
    </span>
  );
}

type CitationChipProps = {
  readonly index: string;
  readonly href: string;
  readonly title?: string;
  readonly className?: string;
};

/**
 * react-markdown passes the custom `a` element to `p`/`li` before it renders
 * into CitationChip — detect either the chip or a citation-bound link.
 */
export function citationIndexFromNode(node: ReactNode): string | null {
  if (!isValidElement(node)) return null;
  const props = node.props as {
    index?: unknown;
    href?: unknown;
    children?: ReactNode;
  };
  if (
    typeof props.index === "string" &&
    typeof props.href === "string" &&
    /^https?:\/\//i.test(props.href) &&
    isCitationLabel(props.index)
  ) {
    return normalizeCitationIndex(props.index);
  }
  if (
    typeof props.href === "string" &&
    /^https?:\/\//i.test(props.href) &&
    isCitationLabel(childrenToPlainText(props.children))
  ) {
    return normalizeCitationIndex(childrenToPlainText(props.children));
  }
  const type = node.type;
  if (
    type === CitationChip ||
    (typeof type === "function" &&
      "displayName" in type &&
      (type as { displayName?: string }).displayName === "CitationChip")
  ) {
    if (typeof props.index === "string") {
      return normalizeCitationIndex(props.index);
    }
  }
  return null;
}

/**
 * Wrap text runs before each citation marker as CitationClaim spans so hover
 * can highlight the claim that the marker supports.
 */
export function wrapCitationClaims(children: ReactNode): ReactNode {
  const kids = Children.toArray(children);
  if (kids.length === 0) return children;

  const out: ReactNode[] = [];
  let buffer: ReactNode[] = [];

  const flush = (index: string, key: string) => {
    if (buffer.length === 0) return;
    out.push(
      <CitationClaim key={key} index={index}>
        {buffer}
      </CitationClaim>,
    );
    buffer = [];
  };

  kids.forEach((child, i) => {
    const index = citationIndexFromNode(child);
    if (index !== null) {
      flush(index, `claim-${index}-${i}`);
      out.push(child);
      return;
    }
    buffer.push(child);
  });

  if (buffer.length > 0) {
    out.push(...buffer);
  }
  return out;
}

function FaviconMark({
  hostname,
  size = 16,
  className,
}: {
  readonly hostname: string;
  readonly size?: number;
  readonly className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (hostname.charAt(0) || "?").toUpperCase();

  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded font-medium",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
      >
        {letter}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote favicon; no next/image domain list
    <img
      src={faviconUrl(hostname)}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded", className)}
      onError={() => setFailed(true)}
    />
  );
}

/** Card peek body: favicon + title + host. */
export function CitationPreviewCard({
  href,
  title,
  className,
}: {
  readonly href: string;
  readonly title?: string;
  readonly className?: string;
}) {
  const host = hostnameOf(href);
  const displayTitle = title?.trim() || host;
  const openInBrowser = useOpenInCanvasBrowser();

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-slot="citation-preview-card"
      className={cn(
        "hover:bg-muted/40 flex gap-3 rounded-md no-underline transition-colors",
        className,
      )}
      onClick={(event) => {
        openInBrowser(href, event);
      }}
    >
      <FaviconMark hostname={host} size={20} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            threadText,
            "text-foreground line-clamp-2 block font-medium",
          )}
        >
          {displayTitle}
        </span>
        <span className={cn(threadMeta, "mt-0.5 block truncate text-[13px]")}>
          {host}
        </span>
      </span>
    </a>
  );
}

export function CitationChip({
  index,
  href,
  title,
  className,
}: CitationChipProps) {
  const label = normalizeCitationIndex(index);
  const displayTitle = title?.trim() || hostnameOf(href);
  const setActiveIndex = useSetCitationActiveIndex();
  const openInBrowser = useOpenInCanvasBrowser();
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  // Keep claim tint in sync with peek open (including controlled updates).
  useEffect(() => {
    if (open) {
      setActiveIndex(label);
      return () => setActiveIndex(null);
    }
    return undefined;
  }, [open, label, setActiveIndex]);

  return (
    <HoverCard open={open} onOpenChange={onOpenChange} openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          data-slot="citation-chip"
          data-citation-index={label}
          aria-label={`Source ${label}: ${displayTitle}`}
          className={cn(
            "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground data-[state=open]:bg-muted/80 data-[state=open]:text-foreground ms-0.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded px-1 align-super text-[11px] leading-none font-medium tabular-nums no-underline transition-colors",
            className,
          )}
          onClick={(event) => {
            openInBrowser(href, event);
          }}
        >
          {label}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 p-3"
      >
        <CitationPreviewCard href={href} title={title} />
      </HoverCardContent>
    </HoverCard>
  );
}
CitationChip.displayName = "CitationChip";

const EMPTY_CITATION_REFS: readonly CitationRef[] = [];

/**
 * Renders a compact sources row under an assistant message when the reply
 * contains numbered citations. Hidden when nothing was cited.
 */
export function MessageSources({ className }: ComponentProps<"div">) {
  // Select a primitive snapshot (string). Returning a fresh array from
  // useAuiState trips React's getSnapshot caching check and loops.
  const markdown = useAuiState((s) => {
    if (s.message.role !== "assistant") return "";
    return s.message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter((text) => text.length > 0)
      .join("\n");
  });
  const openInBrowser = useOpenInCanvasBrowser();

  const refs = useMemo(() => {
    if (!markdown) return EMPTY_CITATION_REFS;
    return extractCitationRefs(markdown);
  }, [markdown]);

  if (refs.length === 0) return null;

  return (
    <div
      data-slot="message-sources"
      className={cn(stepEnter, "flex flex-col gap-1.5 pt-1", className)}
    >
      <p className={cn(threadMeta, "font-medium")}>Sources</p>
      <ol className="flex flex-col gap-1.5">
        {refs.map((ref) => {
          const host = hostnameOf(ref.url);
          const displayTitle = ref.title?.trim() || host;
          return (
            <li key={ref.index} className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "bg-muted text-muted-foreground inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-[11px] leading-none font-medium tabular-nums",
                )}
              >
                {ref.index}
              </span>
              <FaviconMark hostname={host} size={14} />
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  threadMeta,
                  "hover:text-foreground min-w-0 truncate transition-colors",
                )}
                title={ref.title ?? ref.url}
                onClick={(event) => {
                  openInBrowser(ref.url, event);
                }}
              >
                {displayTitle}
                <span className="text-muted-foreground/70"> · {host}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * assistant-ui `source` message part (provider-native citations when present).
 */
export function SourcePart() {
  const part = useAuiState((s) => (s.part.type === "source" ? s.part : null));
  if (!part) return null;

  if (part.sourceType === "url" && part.url) {
    const index = /^\d+$/.test(part.id) ? part.id : "1";
    return (
      <CitationChip
        index={index}
        href={part.url}
        title={part.title}
      />
    );
  }

  if (part.title) {
    return (
      <span
        data-slot="source-document"
        className={cn(
          "bg-muted text-muted-foreground ms-0.5 inline-flex h-4 items-center rounded px-1.5 align-super text-[11px] leading-none font-medium",
        )}
        title={part.title}
      >
        {part.title}
      </span>
    );
  }

  return null;
}
