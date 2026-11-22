"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlusIcon, FolderOpenIcon, LoaderIcon } from "lucide-react";

import {
  pathVersion,
  useCanvas,
} from "@/components/assistant-ui/elements/canvas-context";
import { artifactKindFromBasename } from "@/lib/library/artifact-kind";
import { ghostButton } from "@/lib/surfaces";
import { cn } from "@/lib/utils";

type ArtifactItem = {
  readonly pathname: string;
  readonly basename: string;
  readonly size: number;
  readonly uploadedAt: string;
  readonly kind: "image" | "file";
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Library browser inside the canvas sidebar: search artifacts, open them as
 * file tabs, or create a new text file.
 */
export function CanvasLibraryPanel() {
  const { openDocument, openNewFile } = useCanvas();
  const [items, setItems] = useState<readonly ArtifactItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/artifacts");
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to load library");
      }
      const data = (await res.json()) as {
        artifacts?: readonly ArtifactItem[];
      };
      setItems(data.artifacts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load library");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      item.basename.toLowerCase().includes(needle),
    );
  }, [items, query]);

  const openArtifact = async (item: ArtifactItem) => {
    setOpening(item.pathname);
    try {
      if (item.kind === "image") {
        openDocument({
          id: `artifact:${item.pathname}`,
          path: `/workspace/${item.basename}`,
          content: `/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`,
          running: false,
          note: null,
          version: pathVersion(`/workspace/${item.basename}`),
        });
        return;
      }
      const res = await fetch(
        `/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`,
      );
      if (!res.ok) {
        throw new Error("Could not read that file");
      }
      const text = await res.text();
      openDocument({
        id: `artifact:${item.pathname}`,
        path: `/workspace/${item.basename}`,
        content: text,
        running: false,
        note: null,
        version: pathVersion(`/workspace/${item.basename}`),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to open file");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search library"
          aria-label="Search library"
          className="border-border/60 bg-background h-8 min-w-0 flex-1 rounded-md border px-2.5 text-[13px] outline-none"
        />
        <button
          type="button"
          className={cn(ghostButton, "h-8 gap-1.5 px-2.5 text-[12px]")}
          onClick={() => openNewFile()}
        >
          <FilePlusIcon className="size-3.5" />
          New
        </button>
      </div>

      {loading ? (
        <div className="text-foreground/45 flex flex-1 items-center justify-center gap-2 text-[13px]">
          <LoaderIcon className="size-3.5 animate-spin" />
          Loading library…
        </div>
      ) : error ? (
        <div className="text-destructive flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-[13px]">
          <p>{error}</p>
          <button
            type="button"
            className={cn(ghostButton, "h-8 px-3 text-[12px]")}
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-foreground/45 flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-[13px]">
          <FolderOpenIcon className="size-6 opacity-40" />
          <p>
            {items.length === 0
              ? "Nothing in your library yet. Create a file or ask Pearl to save one."
              : "No matches."}
          </p>
          <button
            type="button"
            className={cn(ghostButton, "h-8 gap-1.5 px-3 text-[12px]")}
            onClick={() => openNewFile()}
          >
            <FilePlusIcon className="size-3.5" />
            New file
          </button>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {visible.map((item) => {
            const kind =
              item.kind ?? artifactKindFromBasename(item.basename);
            return (
              <li key={item.pathname}>
                <button
                  type="button"
                  disabled={opening === item.pathname}
                  onClick={() => void openArtifact({ ...item, kind })}
                  className={cn(
                    "hover:bg-foreground/[0.04] flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    opening === item.pathname && "opacity-60",
                  )}
                >
                  {kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`}
                      alt=""
                      className="bg-muted size-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="bg-muted text-foreground/50 flex size-9 shrink-0 items-center justify-center rounded text-[11px] font-medium uppercase">
                      {extOf(item.basename)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {item.basename}
                    </span>
                    <span className="text-foreground/40 block truncate text-[11px]">
                      {formatSize(item.size)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function extOf(basename: string): string {
  const dot = basename.lastIndexOf(".");
  if (dot < 0) return "file";
  return basename.slice(dot + 1).slice(0, 4) || "file";
}
