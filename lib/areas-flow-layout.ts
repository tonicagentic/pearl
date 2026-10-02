/**
 * Convert the area tree into a mind-map around a synthetic root: top-level
 * areas split left/right by subtree weight, deeper children continue on the
 * same side. Positions are parent-relative so dragging a node moves its
 * subtree. Edges name left/right handles so lines meet node sides.
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
  parentId?: string;
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

function subtreeHeight(node: LayoutArea): number {
  if (node.children.length === 0) {
    return NODE_HEIGHT;
  }

  return (
    node.children.reduce((sum, child) => sum + subtreeHeight(child), 0) +
    Y_GAP * (node.children.length - 1)
  );
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
  parentId: string | undefined,
  position: { x: number; y: number },
  nodes: FlowMindmapNode[],
) {
  nodes.push({
    id: node.id,
    type: "mindmap",
    data: { label: node.name },
    position,
    parentId,
    draggable: false,
    deletable: node.id !== AREAS_ROOT_ID,
    className: node.id === AREAS_ROOT_ID ? "is-root" : undefined,
  });
}

function placeSide(
  children: readonly LayoutArea[],
  parentId: string,
  side: 1 | -1,
  nodes: FlowMindmapNode[],
  edges: FlowMindmapEdge[],
) {
  if (children.length === 0) {
    return;
  }

  const total =
    children.reduce((sum, child) => sum + subtreeHeight(child), 0) +
    Y_GAP * (children.length - 1);
  let y = -total / 2;
  const handles = handlesForSide(side);

  for (const child of children) {
    const height = subtreeHeight(child);
    placeNode(child, parentId, { x: side * X_GAP, y: y + height / 2 }, nodes);
    edges.push({
      id: `e-${parentId}-${child.id}`,
      source: parentId,
      target: child.id,
      type: "mindmap",
      ...handles,
    });
    placeSide(child.children, child.id, side, nodes, edges);
    y += height + Y_GAP;
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

  placeNode(root, undefined, { x: 0, y: 0 }, nodes);
  const { left, right } = partition(tree);
  placeSide(right, root.id, 1, nodes, edges);
  placeSide(left, root.id, -1, nodes, edges);

  return { nodes, edges };
}

export function handlesForOffset(offsetX: number): Pick<
  FlowMindmapEdge,
  "sourceHandle" | "targetHandle"
> {
  return handlesForSide(offsetX < 0 ? -1 : 1);
}
