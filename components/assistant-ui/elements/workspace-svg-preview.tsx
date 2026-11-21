"use client";

import type { ReactNode } from "react";
import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import {
  chatFileUrl,
  isSvgWorkspacePath,
} from "@/lib/design/chat-file-url";
import { fileBasename, isContentUrl } from "@/lib/design/file-preview";
import { prepareSvgDocument, svgToDataUrl } from "@/lib/design/svg";
import { cn } from "@/lib/utils";
import { paper } from "@/lib/surfaces";

function svgImageSrc(args: {
  readonly chatId: string | null;
  readonly path: string;
  readonly content?: string | null;
}): string | null {
  const { chatId, path, content } = args;
  const raw = content?.trim() ? content : null;
  if (raw) {
    if (isContentUrl(raw)) return raw.trim();
    const prepared =
      prepareSvgDocument(raw) ?? (raw.trim().startsWith("<") ? raw : null);
    if (prepared) return svgToDataUrl(prepared);
  }
  // Persisted workspace file — same-origin URL for Save Image As.
  if (chatId) return chatFileUrl({ chatId, path });
  return null;
}

/**
 * Inline SVG drawing for chat. Left-click opens the side panel; the download
 * href enables right-click Save.
 */
export function WorkspaceSvgPreview({
  path,
  label,
  content,
  className,
}: {
  readonly path: string;
  readonly label?: ReactNode;
  readonly content?: string | null;
  readonly className?: string;
}) {
  const { chatId, openPath } = useCanvas();
  const src = svgImageSrc({ chatId, path, content });
  const name = fileBasename(path);
  const downloadHref = chatId
    ? chatFileUrl({ chatId, path, download: true })
    : undefined;

  const open = () => openPath(path, content ?? undefined);

  return (
    <div
      data-slot="workspace-svg-preview"
      className={cn("flex w-full max-w-sm flex-col gap-2", className)}
    >
      <a
        href={downloadHref ?? "#"}
        download={name}
        title={`Open ${path}`}
        onClick={(event) => {
          event.preventDefault();
          open();
        }}
        className={cn(
          paper,
          "block overflow-hidden rounded-2xl transition-transform duration-150 hover:-translate-y-px active:scale-[0.98]",
        )}
      >
        <div className="bg-foreground/[0.03] flex min-h-[8rem] items-center justify-center p-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={name}
              className="max-h-56 max-w-full object-contain"
            />
          ) : (
            <span className="text-foreground/40 font-mono text-xs">
              SVG
            </span>
          )}
        </div>
      </a>
      {label != null ? (
        <a
          href={downloadHref ?? "#"}
          download={name}
          title={`Open ${path}`}
          onClick={(event) => {
            event.preventDefault();
            open();
          }}
          className="text-primary hover:text-primary/80 text-[15px] underline underline-offset-2"
        >
          {label}
        </a>
      ) : null}
    </div>
  );
}

export function isWorkspaceSvgPath(path: string): boolean {
  return isSvgWorkspacePath(path);
}
