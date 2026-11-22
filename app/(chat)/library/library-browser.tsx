"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "@/lib/library/artifact-kind";
import { DeleteArtifactButton } from "./delete-artifact-button";

export type LibraryItem = {
  readonly pathname: string;
  readonly basename: string;
  readonly size: number;
  readonly uploadedAt: string;
  readonly kind: ArtifactKind;
};

type Filter = "all" | "files" | "images";

/**
 * Client Library browser: basename search, All/Files/Images chips, image
 * thumbnails and file rows with open / download / delete.
 */
export function LibraryBrowser({
  initialItems,
}: {
  readonly initialItems: readonly LibraryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "images" && item.kind !== "image") return false;
      if (filter === "files" && item.kind !== "file") return false;
      if (!needle) return true;
      return item.basename.toLowerCase().includes(needle);
    });
  }, [items, query, filter]);

  const images = visible.filter((item) => item.kind === "image");
  const files = visible.filter((item) => item.kind === "file");

  function removeItem(pathname: string) {
    setItems((current) => current.filter((item) => item.pathname !== pathname));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
        Nothing in your library yet. When Pearl saves a file or generates an
        image, it shows up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search library"
          aria-label="Search library"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
        <div className="flex gap-1 rounded-full bg-muted p-0.5 self-start">
          {(
            [
              ["all", "All"],
              ["files", "Files"],
              ["images", "Images"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No matches.
        </div>
      ) : null}

      {images.length > 0 && filter !== "files" ? (
        <section className="flex flex-col gap-2">
          {filter === "all" ? (
            <h2 className="text-sm font-medium text-muted-foreground">Images</h2>
          ) : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((item) => (
              <li
                key={item.pathname}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <a
                  href={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`}
                    alt={item.basename}
                    className="size-full object-cover"
                  />
                </a>
                <div className="flex flex-col gap-2 px-3 py-2">
                  <span className="truncate text-xs font-medium">
                    {item.basename}
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <a
                      className="rounded-md border px-2 py-0.5 hover:bg-accent"
                      href={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}&download=1`}
                    >
                      Download
                    </a>
                    <DeleteArtifactButton
                      pathname={item.pathname}
                      onDeleted={() => removeItem(item.pathname)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {files.length > 0 && filter !== "images" ? (
        <section className="flex flex-col gap-2">
          {filter === "all" ? (
            <h2 className="text-sm font-medium text-muted-foreground">Files</h2>
          ) : null}
          <ul className="flex flex-col gap-2">
            {files.map((item) => (
              <li
                key={item.pathname}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.basename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSize(item.size)} · synced{" "}
                    {new Date(item.uploadedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <a
                    className="rounded-md border px-2.5 py-1 hover:bg-accent"
                    href={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                  <a
                    className="rounded-md border px-2.5 py-1 hover:bg-accent"
                    href={`/api/artifacts/content?pathname=${encodeURIComponent(item.pathname)}&download=1`}
                  >
                    Download
                  </a>
                  <DeleteArtifactButton
                    pathname={item.pathname}
                    onDeleted={() => removeItem(item.pathname)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
