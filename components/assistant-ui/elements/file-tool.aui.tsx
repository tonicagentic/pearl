"use client";

import { memo, useEffect, useRef, useState } from "react";
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
import { ArtifactCard } from "@/components/assistant-ui/elements/artifact-card";
import {
  pathVersion,
  useCanvas,
  versionForCall,
  type CanvasDocument,
} from "@/components/assistant-ui/elements/canvas-context";
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

type ReadFileArgs = {
  readonly filePath?: string;
};

type ReadFileResult = {
  readonly content?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
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

// Inline preview for read_file results: content is already in the event
// stream, so the card renders without any server fetch.
const ReadPreviewCardImpl = ({
  path,
  content,
  running,
}: {
  readonly path: string;
  readonly content: string | null;
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
          Read
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
            aria-label="Reading file"
          />
        ) : (
          <CheckIcon
            className="text-muted-foreground size-3.5 shrink-0"
            aria-hidden="true"
          />
        )}
        {hasContent ? (
          <span
            data-slot="file-card-badge"
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {formatBytes(byteLength)}
          </span>
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

const ReadPreviewCard = memo(ReadPreviewCardImpl);

export const ReadFileToolUI = makeAssistantToolUI<
  ReadFileArgs,
  ReadFileResult | string
>({
  toolName: "read_file",
  // Standalone: render outside the collapsed tool group so the preview is
  // reachable (and mounted) without expanding anything.
  display: "standalone",
  render: ({ args, result, status }) => {
    const path = args?.filePath ?? "file";
    const running = status.type === "running";
    const content =
      typeof result === "object" && result !== null
        ? (result as ReadFileResult).content ?? null
        : null;

    return (
      <ReadPreviewCard
        path={path}
        content={content}
        running={running}
      />
    );
  },
});

// write_file renders as an assistant-ui ArtifactCard. While the call streams
// it claims the page-level canvas (thread narrows to a rail, document takes
// the room); clicking the card toggles the canvas for that file.
function WriteFileRender({
  toolCallId,
  args,
  result,
  status,
}: {
  readonly toolCallId?: string;
  readonly args?: WriteFileArgs;
  readonly result?: WriteFileResult | string;
  readonly status: { readonly type: string };
}) {
  const { document: canvasDoc, openDocument, updateDocument, closeDocument } =
    useCanvas();
  const closedByUserRef = useRef(false);
  const fileResult = typeof result === "object" ? result : undefined;
  const id = toolCallId ?? "write_file";
  const path = fileResult?.path ?? args?.filePath ?? "file";
  const content = args?.content ?? "";
  const running = status.type === "running";
  const note = resultMessage(result);
  const isOpen = canvasDoc?.id === id;
  const byteLength = new TextEncoder().encode(content).length;
  const badge =
    fileResult?.existed === false
      ? "created"
      : fileResult?.existed === true
        ? "updated"
        : "saved";
  const meta = running ? "Writing…" : `${formatBytes(byteLength)} · ${badge}`;
  const version = versionForCall(
    id,
    path,
    !running && fileResult !== undefined,
  );

  // Claim the canvas while the call streams and keep its content current.
  // A user close wins until a new streaming call starts (fresh component).
  useEffect(() => {
    if (running) {
      if (!closedByUserRef.current) {
        openDocument({
          id,
          path,
          content,
          running: true,
          note: null,
          version: pathVersion(path),
        });
      }
    } else if (isOpen) {
      updateDocument(id, {
        path,
        content,
        running: false,
        note: resultMessage(result),
        version,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync the live document when the streamed args change
  }, [id, path, content, running, isOpen, version]);

  const toggleCanvas = () => {
    if (isOpen) {
      closedByUserRef.current = true;
      closeDocument();
    } else {
      closedByUserRef.current = false;
      openDocument({
        id,
        path,
        content,
        running,
        note: resultMessage(result),
        version: pathVersion(path),
      } satisfies CanvasDocument);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5" data-slot="write-file-tool">
      <ArtifactCard
        title={path}
        meta={meta}
        generating={running}
        words={countWords(content)}
        aria-expanded={isOpen}
        onClick={toggleCanvas}
      />
      {note ? (
        <div
          data-slot="write-file-note"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <span>{note}</span>
          {!running && content ? (
            <button
              type="button"
              aria-label={`Download ${path.split("/").pop() || "file"}`}
              className="hover:text-foreground inline-flex shrink-0 items-center gap-1 transition-colors"
              onClick={() => downloadTextFile(path, content)}
            >
              <DownloadIcon className="size-3" aria-hidden="true" />
              Download
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const WriteFileToolUI = makeAssistantToolUI<
  WriteFileArgs,
  WriteFileResult | string
>({
  toolName: "write_file",
  // Standalone: render outside the collapsed tool group so the renderer
  // mounts as soon as the call starts, which is what claims the canvas.
  display: "standalone",
  render: WriteFileRender,
});

// edit_file applies a targeted span replacement to an existing artifact. When
// the file is open on the canvas, the same replacement is applied client-side
// so the document updates in place; otherwise a compact card records the
// edit. Version bumps keep the canvas header's revision number honest.
type EditFileArgs = { filePath?: string; oldText?: string; newText?: string };

function EditFileRender({
  toolCallId,
  args,
  status,
}: {
  readonly toolCallId?: string;
  readonly args?: EditFileArgs;
  readonly status: { readonly type: string };
}) {
  const { document: canvasDoc, updateDocumentByPath } = useCanvas();
  const id = toolCallId ?? "edit_file";
  const path = args?.filePath ?? "file";
  const running = status.type === "running";
  const completed = !running && args?.oldText !== undefined;
  const version = versionForCall(id, path, completed);

  // Mirror the span replacement onto the open canvas document so the viewer
  // updates in place. The canvas is owned by the write_file call that created
  // it, so the update matches by path (not call id — that mismatch is what
  // dropped edits before) and applies functionally off the latest content, so
  // consecutive edits chain correctly. Only when the edited file is the one
  // on the canvas; an edit to a closed file stays a compact card.
  useEffect(() => {
    if (
      !completed ||
      !canvasDoc ||
      !args?.oldText ||
      args.newText === undefined
    ) {
      return;
    }

    updateDocumentByPath(path, (doc) => {
      if (!doc.content.includes(args.oldText!)) {
        return doc;
      }
      return {
        ...doc,
        content: doc.content.replace(args.oldText!, args.newText!),
        running: false,
        version,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply the replacement once per completed call
  }, [completed, path, version]);

  // Visually silent: the tool-timeline already renders this step ("Edited
  // <file>", shimmering while running). This renderer stays mounted only for
  // its side effect — mirroring the span replacement onto the open canvas
  // document and bumping the revision — never for its pixels.
  useEffect(() => {
    if (
      !completed ||
      !canvasDoc ||
      !args?.oldText ||
      args.newText === undefined
    ) {
      return;
    }

    updateDocumentByPath(path, (doc) => {
      if (!doc.content.includes(args.oldText!)) {
        return doc;
      }
      return {
        ...doc,
        content: doc.content.replace(args.oldText!, args.newText!),
        running: false,
        version,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply the replacement once per completed call
  }, [completed, path, version]);

  return null;
}

export const EditFileToolUI = makeAssistantToolUI<EditFileArgs, unknown>({
  toolName: "edit_file",
  display: "standalone",
  render: EditFileRender,
});
