import { type Node } from "@xyflow/react";

export type MindMapNodeData = {
  label: string;
  isNew?: boolean;
};

export type MindMapNode = Node<MindMapNodeData, "mindmap">;
