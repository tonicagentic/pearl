/**
 * Convert the area tree into a mind-map around a synthetic root: top-level
 * areas split left/right by subtree weight, deeper children continue on the
 * same side. The lighter side expands its sibling gaps to fill the taller
 * side's span. Nodes use absolute canvas positions so React Flow's parent
 * bounding boxes cannot shift deeper generations. Edges connect their sides.
 *
 * The root ("Areas") is not a database row — creating a child of it produces
 * a top-level area.
 */

export const AREAS_ROOT_ID = "__areas_root__";

export type LayoutArea = {
  readonly id: string;
  readonly name: string;
  readonly children: readonly LayoutArea[];
};

export type FlowMindmapNode = {
  id: string;
  type: "mindmap";
  data: { label: string; isNew?: boolean };
  position: { x: number; y: number };
  draggable: false;
  deletable: boolean;
  className?: string;
};

export type FlowMindmapEdge = {
  id: string;
  source: string;
  target: string;
  type: "mindmap";
  sourceHandle: "source-left" | "source-right";
  targetHandle: "target-left" | "target-right";
};

const X_GAP = 180;
const Y_GAP = 18;
const NODE_HEIGHT = 40;

function subtreeHeight(node: LayoutArea, gap = Y_GAP): number {
  if (node.children.length === 0) {
    return NODE_HEIGHT;
  }

  return sideHeight(node.children, gap);
}

function sideHeight(children: readonly LayoutArea[], gap = Y_GAP): number {
  if (children.length === 0) return 0;
  return (
    children.reduce((sum, child) => sum + subtreeHeight(child, gap), 0) +
    gap * (children.length - 1)
  );
}

function leafCount(node: LayoutArea): number {
  return node.children.length === 0
    ? 1
    : node.children.reduce((sum, child) => sum + leafCount(child), 0);
}

function expandedGap(children: readonly LayoutArea[], targetHeight: number): number {
  // Every leaf after the first adds one sibling gap somewhere in the side.
  const gaps = children.reduce((sum, child) => sum + leafCount(child), 0) - 1;
  return gaps > 0
    ? Y_GAP + Math.max(0, targetHeight - sideHeight(children)) / gaps
    : Y_GAP;
}

function partition(
  children: readonly LayoutArea[],
): { left: LayoutArea[]; right: LayoutArea[] } {
  const left: LayoutArea[] = [];
  const right: LayoutArea[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const child of children) {
    const height = subtreeHeight(child);
    if (rightHeight <= leftHeight) {
      right.push(child);
      rightHeight += height + (right.length > 1 ? Y_GAP : 0);
    } else {
      left.push(child);
      leftHeight += height + (left.length > 1 ? Y_GAP : 0);
    }
  }

  return { left, right };
}

function handlesForSide(side: 1 | -1): Pick<
  FlowMindmapEdge,
  "sourceHandle" | "targetHandle"
> {
  return side === 1
    ? { sourceHandle: "source-right", targetHandle: "target-left" }
    : { sourceHandle: "source-left", targetHandle: "target-right" };
}

function placeNode(
  node: LayoutArea,
  position: { x: number; y: number },
  nodes: FlowMindmapNode[],
) {
  nodes.push({
    id: node.id,
    type: "mindmap",
    data: { label: node.name },
    position,
    draggable: false,
    deletable: node.id !== AREAS_ROOT_ID,
    className: node.id === AREAS_ROOT_ID ? "is-root" : undefined,
  });
}

function placeSide(
  children: readonly LayoutArea[],
  parentId: string,
  parentPosition: { x: number; y: number },
  side: 1 | -1,
  gap: number,
  nodes: FlowMindmapNode[],
  edges: FlowMindmapEdge[],
) {
  if (children.length === 0) {
    return;
  }

  const total = sideHeight(children, gap);
  let y = -total / 2;
  const handles = handlesForSide(side);

  for (const child of children) {
    const height = subtreeHeight(child, gap);
    const position = {
      x: parentPosition.x + side * X_GAP,
      y: parentPosition.y + y + height / 2,
    };
    placeNode(child, position, nodes);
    edges.push({
      id: `e-${parentId}-${child.id}`,
      source: parentId,
      target: child.id,
      type: "mindmap",
      ...handles,
    });
    placeSide(child.children, child.id, position, side, gap, nodes, edges);
    y += height + gap;
  }
}

export function areasToFlow(tree: readonly LayoutArea[]): {
  nodes: FlowMindmapNode[];
  edges: FlowMindmapEdge[];
} {
  const nodes: FlowMindmapNode[] = [];
  const edges: FlowMindmapEdge[] = [];
  const root: LayoutArea = {
    id: AREAS_ROOT_ID,
    name: "Areas",
    children: tree,
  };

  const rootPosition = { x: 0, y: 0 };
  placeNode(root, rootPosition, nodes);
  const { left, right } = partition(tree);
  const targetHeight = Math.max(sideHeight(left), sideHeight(right));
  placeSide(right, root.id, rootPosition, 1, expandedGap(right, targetHeight), nodes, edges);
  placeSide(left, root.id, rootPosition, -1, expandedGap(left, targetHeight), nodes, edges);

  return { nodes, edges };
}

export function handlesForOffset(offsetX: number): Pick<
  FlowMindmapEdge,
  "sourceHandle" | "targetHandle"
> {
  return handlesForSide(offsetX < 0 ? -1 : 1);
}
