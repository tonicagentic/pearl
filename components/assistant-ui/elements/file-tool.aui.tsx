"use client";

import { memo, useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileIcon,
  LoaderIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PREVIEW_CHAR_LIMIT = 5_000;

type WriteFileArgs = {
  readonly filePath?: string;
  readonly content?: string;
};

type WriteFileResult = {
  readonly path?: string;
  readonly existed?: boolean;
  readonly persisted?: boolean;
  readonly note?: string;
};

type FileToolUIProps = {
  readonly args: WriteFileArgs;
  readonly result?: WriteFileResult | string;
  readonly status: { readonly type: string };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resultMessage(result: WriteFileResult | string | undefined) {
  if (typeof result === "string") return result;
  return result?.note ?? null;
}

function downloadTextFile(path: string, content: string) {
  const filename = path.split("/").pop() || "file";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const FileCardImpl = ({
  label,
  path,
  content,
  badge,
  note,
  running,
}: {
  readonly label: string;
  readonly path: string;
  readonly content: string | null;
  readonly badge: string | null;
  readonly note: string | null;
  readonly running: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const hasContent = content !== null && content.length > 0;
  const byteLength =
    content === null ? 0 : new TextEncoder().encode(content).length;
  const truncated = hasContent && content.length > PREVIEW_CHAR_LIMIT;

  return (
    <Collapsible
      data-slot="file-card-root"
      open={open}
      onOpenChange={setOpen}
      className="bg-card w-full rounded-lg border"
    >
      <div className="flex min-h-9 items-center gap-2 px-3 py-1.5">
        <FileIcon
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        <span
          data-slot="file-card-label"
          className="text-muted-foreground shrink-0 text-xs"
        >
          {label}
        </span>
        <span
          data-slot="file-card-path"
          className="text-foreground min-w-0 flex-1 truncate font-mono text-xs"
          title={path}
        >
          {path}
        </span>
        {running ? (
          <LoaderIcon
            className="text-muted-foreground size-3.5 shrink-0 animate-spin"
            aria-label="Writing file"
          />
        ) : (
          <CheckIcon
            className="text-muted-foreground size-3.5 shrink-0"
            aria-hidden="true"
          />
        )}
        {badge ? (
          <span
            data-slot="file-card-badge"
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {badge}
          </span>
        ) : null}
        {hasContent ? (
          <button
            type="button"
            aria-label={`Download ${path.split("/").pop() || "file"}`}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            onClick={() => downloadTextFile(path, content)}
          >
            <DownloadIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
        {hasContent ? (
          <CollapsibleTrigger
            aria-label={open ? "Collapse preview" : "Expand preview"}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
        ) : null}
      </div>
      {note ? (
        <div
          data-slot="file-card-note"
          className="text-muted-foreground border-t px-3 py-1.5 text-xs"
        >
          {note}
        </div>
      ) : null}
      {hasContent ? (
        <CollapsibleContent>
          <pre
            data-slot="file-card-preview"
            className="bg-muted/50 text-foreground max-h-64 overflow-auto border-t px-3 py-2 font-mono text-xs whitespace-pre-wrap"
          >
            {truncated ? `${content.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : content}
          </pre>
          {truncated ? (
            <div className="text-muted-foreground px-3 pb-1.5 text-xs">
              Preview truncated. Download to see the full file (
              {formatBytes(byteLength)}).
            </div>
          ) : null}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
};

export const FileCard = memo(FileCardImpl);

export const WriteFileToolUI = makeAssistantToolUI<
  WriteFileArgs,
  WriteFileResult | string
>({
  toolName: "write_file",
  render: ({ args, result, status }) => {
    const fileResult = typeof result === "object" ? result : undefined;
    const path = fileResult?.path ?? args?.filePath ?? "file";
    const running = status.type === "running";
    const badge = fileResult?.existed === false ? "created" : fileResult?.existed === true ? "updated" : null;
    const note = resultMessage(result);

    return (
      <FileCard
        label="Saved"
        path={path}
        content={args?.content ?? null}
        badge={badge}
        note={note}
        running={running}
      />
    );
  },
});

type ReadFileArgs = {
  readonly filePath?: string;
};

type ReadFileResult = {
  readonly content?: string;
};

export const ReadFileToolUI = makeAssistantToolUI<
  ReadFileArgs,
  ReadFileResult | string
>({
  toolName: "read_file",
  render: ({ args, result, status }) => {
    const path = args?.filePath ?? "file";
    const running = status.type === "running";
    const content =
      typeof result === "object" && result !== null
        ? (result as ReadFileResult).content ?? null
        : null;

    return (
      <FileCard
        label="Read"
        path={path}
        content={content}
        badge={null}
        note={null}
        running={running}
      />
    );
  },
});
