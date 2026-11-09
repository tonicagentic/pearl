"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

import { cn } from "@/lib/utils";

let mermaidReady = false;

function ensureMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
  });
  mermaidReady = true;
}

export function MermaidBlock({
  code,
  className,
}: {
  readonly code: string;
  readonly className?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    const id = `mermaid-${reactId}`;
    void mermaid
      .render(id, code.trim())
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSvg(null);
          setError(cause instanceof Error ? cause.message : "Mermaid render failed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (error) {
    return (
      <pre
        className={cn(
          "border-border/50 bg-muted/30 overflow-x-auto rounded-xl border p-3.5 text-[13px] leading-relaxed",
          className,
        )}
      >
        <code>{code}</code>
        <div className="text-destructive mt-2 text-xs">{error}</div>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          "text-muted-foreground border-border/50 bg-muted/20 rounded-xl border p-3.5 text-[13px]",
          className,
        )}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border/50 bg-background overflow-x-auto rounded-xl border p-3",
        className,
      )}
      // Mermaid returns trusted SVG from its own renderer with securityLevel strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
