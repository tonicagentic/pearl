"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionLineType,
  Controls,
  type InternalNode,
  type NodeOrigin,
  type OnConnectEnd,
  type OnConnectStart,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import "@xyflow/react/dist/style.css";

import { createAreaAction, deleteAreaAction } from "@/app/actions/issues";
import {
  AREAS_ROOT_ID,
  areasToFlow,
  handlesForOffset,
  type FlowMindmapNode,
} from "@/lib/areas-flow-layout";
import type { AreaNode } from "@/lib/db/issues";

import { AreaSheet, findArea } from "./mindmap/area-sheet";
import { MindMapEdge } from "./mindmap/mind-map-edge";
import { MindMapNodeView } from "./mindmap/mind-map-node";
import "./mindmap/mindmap.css";
import type { MindMapNode } from "./mindmap/types";

const nodeTypes = { mindmap: MindMapNodeView };
const edgeTypes = { mindmap: MindMapEdge };
const nodeOrigin: NodeOrigin = [0.5, 0.5];
const connectionLineStyle = {
  stroke: "var(--color-foreground)",
  strokeWidth: 2,
};
const defaultEdgeOptions = { style: connectionLineStyle, type: "mindmap" };

function treeKey(tree: readonly AreaNode[]): string {
  return JSON.stringify(
    tree.map((node) => ({
      id: node.id,
      name: node.name,
      children: node.children,
    })),
  );
}

function dbParentId(flowParentId: string | undefined): string | null {
  if (!flowParentId || flowParentId === AREAS_ROOT_ID) {
    return null;
  }

  return flowParentId;
}

function FlowCanvas({ tree }: { readonly tree: readonly AreaNode[] }) {
  const router = useRouter();
  const store = useStoreApi();
  const { screenToFlowPosition } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const initial = useMemo(() => areasToFlow(tree), [tree]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const treeSignature = treeKey(tree);

  useEffect(() => {
    const next = areasToFlow(tree);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setEdges, setNodes, tree, treeSignature]);

  const getChildNodePosition = (
    event: MouseEvent | TouchEvent,
    parentNode?: InternalNode,
  ) => {
    const { domNode } = store.getState();

    if (
      !domNode ||
      !parentNode?.internals.positionAbsolute ||
      !parentNode.measured.width ||
      !parentNode.measured.height
    ) {
      return;
    }

    const panePosition = screenToFlowPosition({
      x: "clientX" in event ? event.clientX : event.touches[0].clientX,
      y: "clientY" in event ? event.clientY : event.touches[0].clientY,
    });

    return {
      x: panePosition.x - parentNode.internals.positionAbsolute.x,
      y: panePosition.y - parentNode.internals.positionAbsolute.y,
    };
  };

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const { nodeLookup } = store.getState();
      const target = event.target as Element;
      const targetIsPane = target.classList.contains("react-flow__pane");
      const node = target.closest(".react-flow__node");

      if (node) {
        node.querySelector("input")?.focus({ preventScroll: true });
        return;
      }

      if (!targetIsPane || !connectingNodeId.current) {
        return;
      }

      const parentNode = nodeLookup.get(connectingNodeId.current);

      if (!parentNode) {
        return;
      }

      const position = getChildNodePosition(event, parentNode);

      if (!position) {
        return;
      }

      const tempId = `tmp-${crypto.randomUUID()}`;
      const newNode: FlowMindmapNode = {
        id: tempId,
        type: "mindmap",
        data: { label: "New area", isNew: true },
        position,
        parentId: parentNode.id,
        draggable: false,
        deletable: true,
      };
      const handles = handlesForOffset(position.x);
      const newEdge = {
        id: `e-${parentNode.id}-${tempId}`,
        source: parentNode.id,
        target: tempId,
        type: "mindmap" as const,
        ...handles,
      };

      setNodes((current) => [...current, newNode]);
      setEdges((current) => [...current, newEdge]);

      void (async () => {
        try {
          const row = await createAreaAction({
            name: "New area",
            parentId: dbParentId(parentNode.id),
          });
          setNodes((current) =>
            current.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: row.id,
                    data: { label: row.name },
                  }
                : item,
            ),
          );
          setEdges((current) =>
            current.map((item) =>
              item.target === tempId
                ? {
                    ...item,
                    id: `e-${parentNode.id}-${row.id}`,
                    target: row.id,
                  }
                : item,
            ),
          );
          setSyncError(null);
          setSelectedId(row.id);
        } catch (cause) {
          setNodes((current) => current.filter((item) => item.id !== tempId));
          setEdges((current) =>
            current.filter((item) => item.target !== tempId),
          );
          setSyncError(
            cause instanceof Error
              ? cause.message
              : "The area could not be created.",
          );
        }
      })();
    },
    [getChildNodePosition, setEdges, setNodes, store],
  );

  const onNodesDelete = useCallback(
    (deleted: MindMapNode[]) => {
      const removable = deleted.filter((node) => node.id !== AREAS_ROOT_ID);

      void (async () => {
        try {
          for (const node of removable) {
            if (node.id.startsWith("tmp-")) {
              continue;
            }
            await deleteAreaAction(node.id);
          }
          setSyncError(null);
          router.refresh();
        } catch (cause) {
          setSyncError(
            cause instanceof Error
              ? cause.message
              : "The area could not be deleted.",
          );
          router.refresh();
        }
      })();
    },
    [router],
  );

  const selected = selectedId ? findArea(tree, selectedId) : null;

  return (
    <>
      {syncError ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-4">
          <p className="pointer-events-auto rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {syncError}
          </p>
        </div>
      ) : null}
      <ReactFlow
        className="pearl-areas-flow"
        colorMode="system"
        connectionLineStyle={connectionLineStyle}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={["Backspace", "Delete"]}
        edges={edges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
        nodesDraggable={false}
        nodeOrigin={nodeOrigin}
        nodeTypes={nodeTypes}
        onConnectEnd={onConnectEnd}
        onConnectStart={onConnectStart}
        onNodeClick={(_, node) => {
          if (node.id === AREAS_ROOT_ID || node.id.startsWith("tmp-")) {
            return;
          }
          setSelectedId(node.id);
        }}
        onEdgesChange={onEdgesChange}
        onNodesChange={(changes) =>
          onNodesChange(changes.filter((change) => change.type !== "position"))
        }
        onNodesDelete={onNodesDelete}
        proOptions={{ hideAttribution: false }}
      >
        <Controls
          className="!bottom-4 !left-4 md:!left-4"
          showInteractive={false}
        />
      </ReactFlow>
      <AreaSheet
        area={selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}

export function AreaMindmap({ tree }: { readonly tree: readonly AreaNode[] }) {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <FlowCanvas tree={tree} />
      </ReactFlowProvider>
    </div>
  );
}
