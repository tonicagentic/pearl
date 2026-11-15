import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "../../../../lib/chat/coder-receipt";
import { mono, paper, threadDiffAdd, threadDiffRemove } from "./surfaces";

export type { FileTreeNode };

export function FileTree({
  nodes,
  visibleCount,
  totalAdditions,
  totalDeletions,
  className,
}: {
  readonly nodes: readonly FileTreeNode[];
  readonly visibleCount: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly className?: string;
}) {
  const visible = nodes.slice(0, Math.max(0, visibleCount));
  const fileCount = nodes.filter((n) => n.kind === "file").length;

  return (
    <View className={cn(paper, "w-full flex-col overflow-hidden rounded-2xl", className)}>
      <View className="flex-row items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        <Text variant="secondary" tone="default" className="flex-1">
          {fileCount} file{fileCount === 1 ? "" : "s"} changed
        </Text>
        <Text variant="caption" tone="default" className={cn(mono, threadDiffAdd)}>
          +{totalAdditions}
        </Text>
        <Text variant="caption" tone="default" className={cn(mono, threadDiffRemove)}>
          −{totalDeletions}
        </Text>
      </View>
      <View className="flex-col py-1.5">
        {visible.map((node) => (
          <View
            key={node.path}
            className="flex-row items-center gap-2 py-1 pr-3.5"
            style={{ paddingLeft: 14 + node.depth * 14 }}
          >
            <Text
              variant="caption"
              tone="default"
              numberOfLines={1}
              className={cn(
                mono,
                "min-w-0 flex-1",
                node.kind === "folder" ? "opacity-40" : "opacity-75",
              )}
            >
              {node.name}
            </Text>
            {node.kind === "file" && (node.additions || node.deletions) ? (
              <>
                {node.additions ? (
                  <Text variant="caption" tone="default" className={cn(mono, threadDiffAdd)}>
                    +{node.additions}
                  </Text>
                ) : null}
                {node.deletions ? (
                  <Text variant="caption" tone="default" className={cn(mono, threadDiffRemove)}>
                    −{node.deletions}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
