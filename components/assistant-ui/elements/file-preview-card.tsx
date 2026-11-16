"use client";

import { useEffect, useState, type ComponentProps } from "react";
import {
  FileTextIcon,
  ImageIcon,
  BracesIcon,
  FileIcon,
} from "lucide-react";
import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { previewKindForPath } from "@/lib/design/preview-kind";
import {
  fileBasename,
  filePreviewSnippet,
  isContentUrl,
  previewKindLabel,
} from "@/lib/design/file-preview";
import { cn } from "@/lib/utils";
import { mono, paper } from "@/lib/surfaces";

type FileListEntry = {
  readonly id: string;
  readonly path: string;
};

const listCache = new Map<string, Promise<readonly FileListEntry[]>>();
const contentCache = new Map<string, Promise<string | null>>();

async function listChatFiles(
  chatId: string,
): Promise<readonly FileListEntry[]> {
  const cached = listCache.get(chatId);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/files`);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        files?: readonly FileListEntry[];
      };
      return data.files ?? [];
    } catch {
      return [];
    }
  })();
  listCache.set(chatId, promise);
  return promise;
}

async function fetchChatFileContent(
  chatId: string,
  path: string,
): Promise<string | null> {
  const key = `${chatId}:${path}`;
  const cached = contentCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const files = await listChatFiles(chatId);
    const file = files.find(
      (entry) => entry.path === path || entry.path.endsWith(`/${path}`),
    );
    if (!file) return null;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/files?fileId=${encodeURIComponent(file.id)}`,
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  })();
  contentCache.set(key, promise);
  return promise;
}

function KindIcon({ path }: { readonly path: string }) {
  const kind = previewKindForPath(path);
  const className = "size-4";
  if (kind === "image" || kind === "svg") {
    return <ImageIcon className={className} aria-hidden />;
  }
  if (kind === "markdown" || kind === "html" || kind === "pdf") {
    return <FileTextIcon className={className} aria-hidden />;
  }
  if (kind === "scene" || path.toLowerCase().endsWith(".json")) {
    return <BracesIcon className={className} aria-hidden />;
  }
  return <FileIcon className={className} aria-hidden />;
}

/**
 * Chat mention of a workspace file: card with a short preview that opens
 * the canvas explorer.
 */
export function FilePreviewCard({
  path,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children" | "type" | "onClick"> & {
  readonly path: string;
}) {
  const { chatId, openPath } = useCanvas();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(chatId));
  const name = fileBasename(path);
  const kind = previewKindForPath(path);
  const label = previewKindLabel(kind);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchChatFileContent(chatId, path).then((text) => {
      if (cancelled) return;
      setContent(text);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, path]);

  const imageSrc =
    content &&
    (kind === "image" || kind === "svg") &&
    (kind === "image"
      ? isContentUrl(content)
        ? content.trim()
        : null
      : // Inline SVG: render via data URL for the card thumb.
        content.trim().startsWith("<")
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
        : isContentUrl(content)
          ? content.trim()
          : null);

  const snippet =
    content &&
    (kind === "markdown" || kind === "text" || kind === "mermaid")
      ? filePreviewSnippet(content)
      : null;

  return (
    <button
      type="button"
      data-slot="file-preview-card"
      title={`Open ${path}`}
      onClick={() => openPath(path, content ?? undefined)}
      className={cn(
        paper,
        "group flex w-full max-w-sm flex-col overflow-hidden rounded-2xl text-left transition-transform duration-150 hover:-translate-y-px active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      {imageSrc ? (
        <div className="bg-foreground/[0.03] max-h-40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            className="aspect-[2/1] w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex items-start gap-3 p-3.5">
        <span className="bg-foreground/[0.05] text-foreground/45 flex size-9 shrink-0 items-center justify-center rounded-xl">
          <KindIcon path={path} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{name}</p>
          <p className={cn(mono, "text-foreground/40 mt-0.5")}>
            {loading ? "Loading…" : label}
          </p>
          {snippet ? (
            <p className="text-foreground/55 mt-2 line-clamp-3 text-xs leading-relaxed whitespace-pre-wrap">
              {snippet}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function isFilePreviewCardElement(
  node: unknown,
): boolean {
  return (
    typeof node === "object" &&
    node !== null &&
    "props" in node &&
    typeof (node as { props?: { "data-slot"?: string } }).props === "object" &&
    (node as { props?: { "data-slot"?: string } }).props?.["data-slot"] ===
      "file-preview-card"
  );
}
