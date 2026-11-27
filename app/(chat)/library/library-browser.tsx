"use client";

import { useMemo, useState } from "react";
import { AgentDirectory } from "@/components/custom-agents/agent-directory";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "@/lib/library/artifact-kind";
import type { LibraryQuoteDto } from "@/lib/db/library-quotes";
import type { AgentTemplateSummary } from "@/lib/custom-agents/template-types";
import { DeleteArtifactButton } from "./delete-artifact-button";
import { DeleteQuoteButton } from "./delete-quote-button";

export type LibraryItem = {
  readonly pathname: string;
  readonly basename: string;
  readonly size: number;
  readonly uploadedAt: string;
  readonly kind: ArtifactKind;
};

export type LibraryQuoteItem = LibraryQuoteDto;

type Filter = "all" | "files" | "images" | "quotes" | "templates";

/**
 * Client Library browser: search, All/Files/Images/Quotes/Templates chips,
 * open / download / delete for artifacts plus quote cards and agent templates.
 */
export function LibraryBrowser({
  initialItems,
  initialQuotes,
  templates = [],
  artifactsError = null,
  quotesError = null,
}: {
  readonly initialItems: readonly LibraryItem[];
  readonly initialQuotes?: readonly LibraryQuoteItem[];
  readonly templates?: readonly AgentTemplateSummary[];
  /** Blob list failed; quotes may still be shown. */
  readonly artifactsError?: string | null;
  /** Quotes list failed; files may still be shown. */
  readonly quotesError?: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [quotes, setQuotes] = useState(initialQuotes ?? []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const needle = query.trim().toLowerCase();

  const visibleArtifacts = useMemo(() => {
    if (filter === "quotes" || filter === "templates") return [];
    return items.filter((item) => {
      if (filter === "images" && item.kind !== "image") return false;
      if (filter === "files" && item.kind !== "file") return false;
      if (!needle) return true;
      return item.basename.toLowerCase().includes(needle);
    });
  }, [items, needle, filter]);

  const visibleQuotes = useMemo(() => {
    if (filter === "files" || filter === "images" || filter === "templates") {
      return [];
    }
    return quotes.filter((quote) => {
      if (!needle) return true;
      return (
        quote.text.toLowerCase().includes(needle) ||
        (quote.chatTitle?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [quotes, needle, filter]);

  const images = visibleArtifacts.filter((item) => item.kind === "image");
  const files = visibleArtifacts.filter((item) => item.kind === "file");

  function removeItem(pathname: string) {
    setItems((current) => current.filter((item) => item.pathname !== pathname));
  }

  function removeQuote(id: string) {
    setQuotes((current) => current.filter((quote) => quote.id !== id));
  }

  const hasAnything =
    items.length > 0 || quotes.length > 0 || templates.length > 0;
  const hasVisible =
    filter === "templates"
      ? templates.length > 0
      : images.length > 0 || files.length > 0 || visibleQuotes.length > 0;

  if (!hasAnything) {
    return (
      <div className="flex flex-col gap-3">
        {artifactsError ? (
          <div className="rounded-lg border bg-card px-3 py-3 text-sm text-muted-foreground">
            {artifactsError}
          </div>
        ) : null}
        {quotesError ? (
          <div className="rounded-lg border bg-card px-3 py-3 text-sm text-muted-foreground">
            {quotesError}
          </div>
        ) : null}
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          Nothing in your library yet. When Pearl saves a file or generates an
          image, it shows up here. You can also highlight text in a chat reply
          and save it as a quote, or add an agent template into a project.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {artifactsError ? (
        <div className="rounded-lg border bg-card px-3 py-3 text-sm text-muted-foreground">
          {artifactsError}
        </div>
      ) : null}
      {quotesError ? (
        <div className="rounded-lg border bg-card px-3 py-3 text-sm text-muted-foreground">
          {quotesError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search library"
          aria-label="Search library"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-0.5 self-start">
          {(
            [
              ["all", "All"],
              ["files", "Files"],
              ["images", "Images"],
              ["quotes", "Quotes"],
              ["templates", "Templates"],
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

      {filter === "templates" ? (
        <AgentDirectory
          description="Add a ready-made role into one of your projects."
          heading="Agent templates"
          templates={templates}
        />
      ) : null}

      {!hasVisible ? (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No matches.
        </div>
      ) : null}

      {visibleQuotes.length > 0 &&
      filter !== "files" &&
      filter !== "images" ? (
        <section className="flex flex-col gap-2">
          {filter === "all" ? (
            <h2 className="text-sm font-medium text-muted-foreground">Quotes</h2>
          ) : null}
          <ul className="flex flex-col gap-2">
            {visibleQuotes.map((quote) => (
              <li
                key={quote.id}
                className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <blockquote className="border-muted-foreground/30 text-sm leading-6 wrap-break-word border-s-2 ps-3 whitespace-pre-wrap">
                    {quote.text}
                  </blockquote>
                  <span className="text-xs text-muted-foreground">
                    Saved{" "}
                    {new Date(quote.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {quote.chatTitle ? ` · ${quote.chatTitle}` : null}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
                  {quote.chatId ? (
                    <a
                      className="rounded-md border px-2.5 py-1 hover:bg-accent"
                      href={
                        quote.messageId
                          ? `/chat/${quote.chatId}#quote-${quote.messageId}`
                          : `/chat/${quote.chatId}`
                      }
                    >
                      Open chat
                    </a>
                  ) : null}
                  <DeleteQuoteButton
                    quoteId={quote.id}
                    onDeleted={() => removeQuote(quote.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {images.length > 0 && filter !== "files" && filter !== "quotes" ? (
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

      {files.length > 0 && filter !== "images" && filter !== "quotes" ? (
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
