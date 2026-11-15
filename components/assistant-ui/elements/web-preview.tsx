"use client";

import type { ComponentProps, ReactNode } from "react";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { field, ghostButton, mono, paper, ShimmerLabel } from "./surfaces";

export function WebPreview({
  origin,
  loading,
  onReload,
  onOpenExternal,
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  origin: string;
  loading: boolean;
  onReload?: () => void;
  onOpenExternal?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="web-preview"
      className={cn(
        paper,
        "flex w-full flex-col overflow-hidden rounded-2xl",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          aria-label="Reload preview"
          onClick={onReload}
          className={cn(ghostButton, "size-7 shrink-0")}
        >
          <RefreshCwIcon
            className={cn("size-3.5", loading && "animate-spin")}
            aria-hidden
          />
        </button>
        <div
          className={cn(
            field,
            mono,
            "text-foreground/55 min-w-0 flex-1 truncate rounded-full px-3 py-1",
          )}
        >
          {origin}
        </div>
        <button
          type="button"
          aria-label="Open preview in a new tab"
          onClick={onOpenExternal}
          className={cn(ghostButton, "size-7 shrink-0")}
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="relative min-h-56 w-full">
        <div
          className={cn(
            "h-full w-full transition-opacity",
            loading && "invisible opacity-0",
          )}
        >
          {children}
        </div>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ShimmerLabel className="text-foreground/45 text-xs">
              Loading preview
            </ShimmerLabel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
