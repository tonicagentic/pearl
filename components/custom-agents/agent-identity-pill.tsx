"use client";

import { cn } from "@/lib/utils";

/** Teal pause-mark avatar used inside the identity pill. */
export function AgentAccentMark({
  accent = "#2DD4BF",
  className,
  size = "sm",
}: {
  readonly accent?: string;
  readonly className?: string;
  readonly size?: "sm" | "md";
}) {
  const dim = size === "md" ? "size-6" : "size-4";
  const bar = size === "md" ? "h-2.5 w-0.5" : "h-1.5 w-0.5";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        dim,
        className,
      )}
      style={{ backgroundColor: accent }}
    >
      <span className="inline-flex items-center gap-0.5">
        <span className={cn("rounded-full bg-white", bar)} />
        <span className={cn("rounded-full bg-white", bar)} />
      </span>
    </span>
  );
}

/**
 * Grok-style attachment pill: accent circle + agent name. Replaces the
 * Computer toolbar control on custom-agent threads.
 */
export function AgentIdentityPill({
  name,
  accent = "#2DD4BF",
  className,
  onClick,
}: {
  readonly name: string;
  readonly accent?: string;
  readonly className?: string;
  readonly onClick?: () => void;
}) {
  const label = name.trim() || "Agent";
  const shared = cn(
    "inline-flex h-7 max-w-[12rem] items-center gap-1.5 rounded-full border border-border bg-muted/40 px-1.5 pr-2.5 text-xs font-medium text-foreground transition-colors",
    onClick ? "hover:bg-muted/70" : null,
    className,
  );

  const body = (
    <>
      <AgentAccentMark accent={accent} />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={`${label} settings`}
        className={shared}
        onClick={onClick}
        type="button"
      >
        {body}
      </button>
    );
  }

  return <span className={shared}>{body}</span>;
}
