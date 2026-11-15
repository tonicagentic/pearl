"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { mono, paper, threadDiffAdd, threadDiffRemove } from "./surfaces";
import type { FileTreeNode } from "@/lib/chat/coder-receipt";

export type { FileTreeNode };

export function FileTree({
  nodes,
  visibleCount,
  totalAdditions,
  totalDeletions,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  nodes: readonly FileTreeNode[];
  visibleCount: number;
  totalAdditions: number;
  totalDeletions: number;
}) {
  const visible = nodes.slice(0, Math.max(0, visibleCount));
  const fileCount = nodes.filter((n) => n.kind === "file").length;

  return (
    <div
      data-slot="file-tree"
      className={cn(paper, "flex w-full flex-col overflow-hidden rounded-2xl", className)}
      {...props}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        <span className="text-[13px]">
          {fileCount} file{fileCount === 1 ? "" : "s"} changed
        </span>
        <span className={cn(mono, threadDiffAdd, "ms-auto")}>
          +{totalAdditions}
        </span>
        <span className={cn(mono, threadDiffRemove)}>−{totalDeletions}</span>
      </div>
      <div className="flex flex-col py-1.5">
        {visible.map((node) => (
          <div
            key={node.path}
            className="flex items-center gap-2 px-3.5 py-1"
            style={{ paddingLeft: `${0.875 + node.depth * 0.85}rem` }}
          >
            <span
              className={cn(
                mono,
                "min-w-0 flex-1 truncate",
                node.kind === "folder"
                  ? "text-foreground/40"
                  : "text-foreground/75",
              )}
            >
              {node.name}
            </span>
            {node.kind === "file" && (node.additions || node.deletions) ? (
              <>
                {node.additions ? (
                  <span className={cn(mono, threadDiffAdd)}>
                    +{node.additions}
                  </span>
                ) : null}
                {node.deletions ? (
                  <span className={cn(mono, threadDiffRemove)}>
                    −{node.deletions}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
