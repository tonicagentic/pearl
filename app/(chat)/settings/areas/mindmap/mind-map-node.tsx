"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

import { AREAS_ROOT_ID } from "@/lib/areas-flow-layout";

import { type MindMapNode } from "./types";

export function MindMapNodeView({ id, data }: NodeProps<MindMapNode>) {
  const locked = id === AREAS_ROOT_ID;

  return (
    <>
      {locked ? (
        <span className="sr-only">Areas root</span>
      ) : (
        <div className="inputWrapper">
          <span className="label">{data.label}</span>
          <span className="sr-only">Open {data.label}</span>
        </div>
      )}
      <Handle id="target-left" position={Position.Left} type="target" />
      <Handle id="target-right" position={Position.Right} type="target" />
      <Handle id="source-left" position={Position.Left} type="source" />
      <Handle id="source-right" position={Position.Right} type="source" />
    </>
  );
}
