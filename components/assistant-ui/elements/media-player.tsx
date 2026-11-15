"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

export function VideoPlayer({
  src,
  poster,
  title,
  ratio = "16:9",
  durationMs,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "title"> & {
  src: string;
  poster?: string;
  title?: string;
  ratio?: "16:9" | "4:3" | "1:1" | "9:16" | "auto";
  durationMs?: number;
}) {
  const aspect =
    ratio === "auto"
      ? undefined
      : ratio === "4:3"
        ? "aspect-[4/3]"
        : ratio === "1:1"
          ? "aspect-square"
          : ratio === "9:16"
            ? "aspect-[9/16]"
            : "aspect-video";

  return (
    <div
      data-slot="video-player"
      className={cn(
        paper,
        "flex w-full flex-col overflow-hidden rounded-2xl",
        className,
      )}
      {...props}
    >
      <div className={cn("bg-foreground/[0.04] w-full", aspect)}>
        <video
          src={src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full"
          aria-label={title ?? "Video"}
        />
      </div>
      {(title || durationMs !== undefined) && (
        <div className="flex items-center gap-2 px-3.5 py-2">
          {title ? (
            <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
          ) : null}
          {durationMs !== undefined ? (
            <span className={cn(mono, "text-foreground/40 shrink-0")}>
              {Math.max(1, Math.round(durationMs / 1000))}s
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
