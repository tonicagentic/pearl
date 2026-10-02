import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";

export function MindMapEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return <BaseEdge path={edgePath} style={style} />;
}
