"use client";

import { useEffect, useRef, useState } from "react";
import type { AreaNode } from "@/lib/db/issues";

/**
 * Renders the area tree as a Mermaid mind map. The structure is
 * just parentId, so the visualization is a projection of the same data the
 * editor below it changes — nothing to keep in sync.
 *
 * mermaid is loaded dynamically (it is a large dependency) and renders to an
 * SVG string we mount directly; `securityLevel: "strict"` keeps the generated
 * SVG inert. Labels are sanitized because Mermaid's mindmap parser treats
 * brackets/parens as node-shape syntax.
 */
export function AreaMindmap({
  tree,
}: {
  readonly tree: readonly AreaNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const definition = buildMindmapDefinition(tree);

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const { svg: rendered } = await mermaid.render(
          `areas-${Math.random().toString(36).slice(2)}`,
          definition,
        );

        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to render the mind map.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tree]);

  if (error) {
    return (
      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        The mind map could not be rendered: {error}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center overflow-x-auto rounded-lg border bg-card px-4 py-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : {})}
    >
      {!svg ? (
        <p className="py-6 text-sm text-muted-foreground">Rendering the mind map…</p>
      ) : null}
    </div>
  );
}

/**
 * Mermaid mindmap syntax: one indented line per node. The root renders as a
 * circle. Labels are escaped so a area named "Calls (weekly)" does
 * not parse as a shape.
 */
export function buildMindmapDefinition(
  tree: readonly AreaNode[],
): string {
  const lines = ["mindmap", "  root((Areas))"];

  for (const node of tree) {
    appendNode(lines, node, 2);
  }

  return lines.join("\n");
}

function appendNode(
  lines: string[],
  node: AreaNode,
  depth: number,
) {
  const indent = "  ".repeat(depth);

  lines.push(`${indent}${sanitizeLabel(node.name)}`);

  for (const child of node.children) {
    appendNode(lines, child, depth + 1);
  }
}

function sanitizeLabel(name: string): string {
  return name.replace(/[[\](){}]/g, " ").replace(/\s+/g, " ").trim();
}
