"use client";

import {
  isValidElement,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useAuiState } from "@assistant-ui/react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { threadMeta, threadText } from "./surfaces";

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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          data-slot="citation-chip"
          aria-label={`Source ${label}: ${displayTitle}`}
          className={cn(
            "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground ms-0.5 inline-flex h-4 min-w-4 translate-y-[-1px] items-center justify-center rounded px-1 align-super text-[11px] leading-none font-medium tabular-nums no-underline transition-colors",
            className,
          )}
        >
          {label}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 gap-1 p-3"
      >
        <p className={cn(threadText, "text-foreground line-clamp-3 font-medium")}>
          {displayTitle}
        </p>
        <p className={cn(threadMeta, "truncate text-[13px]")}>{hostnameOf(href)}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

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

  const refs = useMemo(() => {
    if (!markdown) return EMPTY_CITATION_REFS;
    return extractCitationRefs(markdown);
  }, [markdown]);

  if (refs.length === 0) return null;

  return (
    <div
      data-slot="message-sources"
      className={cn("flex flex-col gap-1.5 pt-1", className)}
    >
      <p className={cn(threadMeta, "font-medium")}>Sources</p>
      <ol className="flex flex-col gap-1">
        {refs.map((ref) => (
          <li key={ref.index} className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                "bg-muted text-muted-foreground inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-[11px] leading-none font-medium tabular-nums",
              )}
            >
              {ref.index}
            </span>
            <a
              href={ref.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                threadMeta,
                "hover:text-foreground min-w-0 truncate transition-colors",
              )}
              title={ref.title ?? ref.url}
            >
              {ref.title?.trim() || hostnameOf(ref.url)}
              <span className="text-muted-foreground/70"> · {hostnameOf(ref.url)}</span>
            </a>
          </li>
        ))}
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
