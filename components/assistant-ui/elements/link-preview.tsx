"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { paper } from "./surfaces";

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export function LinkPreview({
  href,
  title,
  description,
  image,
  imageAlt = "",
  siteName,
  favicon,
  layout = "card",
  className,
  ...props
}: Omit<ComponentProps<"article">, "children" | "title"> & {
  href: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  favicon?: string;
  layout?: "card" | "compact";
}) {
  const safe = isSafeHref(href);
  const host = hostOf(href);
  const label = title ?? host;
  const site = siteName ?? host;
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const showImage = Boolean(image) && !imageFailed;

  const body = (
    <>
      {showImage && layout === "card" ? (
        <div data-slot="link-preview-image" className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={imageAlt}
            className="aspect-[2/1] w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}
      <div
        className={cn(
          "flex gap-3 p-3.5",
          layout === "compact" && showImage && "items-start",
        )}
      >
        {showImage && layout === "compact" ? (
          <div
            data-slot="link-preview-image"
            className="size-16 shrink-0 overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={imageAlt}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="text-foreground/45 mb-1 flex items-center gap-1.5 text-[11px]">
            {favicon && !faviconFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={favicon}
                alt=""
                className="size-3.5 rounded-sm"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <span className="bg-foreground/10 flex size-3.5 items-center justify-center rounded-sm text-[9px] uppercase">
                {site.slice(0, 1)}
              </span>
            )}
            {site}
          </span>
          {safe ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="after:absolute after:inset-0 text-[13.5px] font-medium hover:underline"
            >
              <span className="line-clamp-2">{label}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="line-clamp-2 text-[13.5px] font-medium">
              {label}
            </span>
          )}
          {description ? (
            <span className="text-foreground/55 mt-1 line-clamp-2 block text-xs leading-relaxed">
              {description}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <article
      data-slot="link-preview"
      data-layout={layout}
      className={cn(
        paper,
        "relative flex w-full flex-col overflow-hidden rounded-2xl",
        className,
      )}
      {...props}
    >
      {body}
    </article>
  );
}
