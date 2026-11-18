import { useEffect, useRef } from "react";
import { useAuiState } from "@assistant-ui/react-native";

import { useWorkspaceOptional } from "@/src/workspace-context";
import {
  editFileArgsFromParts,
  writeFileContentFromArgs,
  writeFilePathFromArgs,
} from "@/src/write-file-args";

type FileToolClaimProps = {
  readonly toolName: string;
  readonly args?: Record<string, unknown>;
  readonly argsText?: string;
  readonly status: { readonly type: string };
  readonly result?: unknown;
  readonly toolCallId?: string;
};

function resultNote(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const note = (result as { note?: unknown }).note;
    return typeof note === "string" ? note : null;
  }
  return null;
}

function resultPath(result: unknown): string | undefined {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const path = (result as { path?: unknown }).path;
    return typeof path === "string" ? path : undefined;
  }
  return undefined;
}

/**
 * Side-effect mount: claims the mobile file canvas while write_file streams
 * and mirrors edit_file patches onto the open buffer. Renders nothing.
 */
export function FileToolClaim({
  toolName,
  args,
  argsText,
  status,
  result,
  toolCallId,
}: FileToolClaimProps) {
  const workspace = useWorkspaceOptional();
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    if (!workspace) return;

    if (toolName === "write_file") {
      const path =
        resultPath(result) ??
        writeFilePathFromArgs(args, argsText) ??
        "file";
      const content = writeFileContentFromArgs(args, argsText) ?? "";
      const running = status.type === "running";
      const key = `${path}:${running}:${content.length}:${content.slice(-24)}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      workspace.openOrClaimWrite({
        id: toolCallId,
        path,
        content,
        running,
        note: running ? null : resultNote(result),
      });
      return;
    }

    if (toolName === "edit_file" && status.type !== "running") {
      const edit = editFileArgsFromParts(args);
      if (
        !edit.filePath ||
        edit.oldText === undefined ||
        edit.newText === undefined
      ) {
        return;
      }
      const key = `edit:${edit.filePath}:${edit.oldText.length}:${edit.newText.length}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      workspace.applyEditPatch(edit.filePath, edit.oldText, edit.newText);
    }
  }, [workspace, toolName, args, argsText, status.type, result, toolCallId]);

  return null;
}

type MessageToolPart = {
  readonly type?: string;
  readonly toolName?: string;
  readonly toolCallId?: string;
  readonly args?: Record<string, unknown>;
  readonly argsText?: string;
  readonly status?: { readonly type?: string };
  readonly result?: unknown;
};

/**
 * Mounts canvas claims for every write_file / edit_file part on the current
 * assistant message — including timeline-covered edit_file calls that never
 * render ToolFallback.
 */
export function MessageFileToolClaims() {
  const parts = useAuiState((s) => s.message.parts) as readonly MessageToolPart[];
  return (
    <>
      {parts.map((part, index) => {
        if (part.type !== "tool-call") return null;
        if (part.toolName !== "write_file" && part.toolName !== "edit_file") {
          return null;
        }
        return (
          <FileToolClaim
            key={part.toolCallId ?? `${part.toolName}-${index}`}
            toolName={part.toolName}
            args={part.args}
            argsText={part.argsText}
            status={{ type: part.status?.type ?? "complete" }}
            result={part.result}
            toolCallId={part.toolCallId}
          />
        );
      })}
    </>
  );
}
