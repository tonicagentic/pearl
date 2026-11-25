"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyRight,
  type SankeyGraph,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";

import type {
  SpendSankeyGraph,
  SpendSankeyLink,
  SpendSankeyNode,
} from "@/lib/finance/spend-sankey";
import { cn } from "@/lib/utils";

type LayoutNode = SankeyNode<SpendSankeyNode, SpendSankeyLink> & SpendSankeyNode;
type LayoutLink = SankeyLink<SpendSankeyNode, SpendSankeyLink>;

const WIDTH = 720;
const HEIGHT = 420;
const NODE_WIDTH = 14;
const NODE_PADDING = 18;

function nodeFill(kind: SpendSankeyNode["kind"]) {
  switch (kind) {
    case "spent":
      return "var(--foreground)";
    case "group":
      return "color-mix(in oklab, var(--foreground) 55%, var(--muted-foreground))";
    default:
      return "var(--muted-foreground)";
  }
}

export function SpendSankey({
  graph,
  className,
}: {
  readonly graph: SpendSankeyGraph;
  readonly className?: string;
}) {
  const router = useRouter();

  const layout = useMemo(() => {
    if (graph.nodes.length === 0 || graph.links.length === 0) return null;

    const links = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }));

    const generator = sankey<SpendSankeyNode, SpendSankeyLink>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyRight)
      .extent([
        [8, 8],
        [WIDTH - 8, HEIGHT - 8],
      ]);

    const input: SankeyGraph<SpendSankeyNode, SpendSankeyLink> = {
      nodes: graph.nodes.map((n) => ({ ...n })),
      links,
    };

    return generator(input) as SankeyGraph<LayoutNode, LayoutLink> & {
      nodes: LayoutNode[];
      links: LayoutLink[];
    };
  }, [graph]);

  if (!layout) {
    return (
      <p className="text-sm text-muted-foreground">
        No spend in this month yet.
      </p>
    );
  }

  const path = sankeyLinkHorizontal();

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("h-auto w-full max-w-full", className)}
      role="img"
      aria-label={`Spend flow for ${graph.label}`}
    >
      <title>{`Spend ${graph.totalSpentLabel} · ${graph.label}`}</title>
      {layout.links.map((link, i) => {
        const source = link.source as LayoutNode;
        const target = link.target as LayoutNode;
        const d = path(link);
        if (!d) return null;
        return (
          <path
            key={`link-${source.id}-${target.id}-${i}`}
            d={d}
            fill="none"
            stroke="var(--border)"
            strokeOpacity={0.85}
            strokeWidth={Math.max(1, link.width ?? 1)}
          />
        );
      })}
      {layout.nodes.map((node) => {
        const x0 = node.x0 ?? 0;
        const x1 = node.x1 ?? 0;
        const y0 = node.y0 ?? 0;
        const y1 = node.y1 ?? 0;
        const clickable = Boolean(node.href);
        const labelOnRight = node.kind !== "spent";
        const labelX = labelOnRight ? x1 + 8 : x0 - 8;
        const textAnchor = labelOnRight ? "start" : "end";

        return (
          <g key={node.id}>
            <rect
              x={x0}
              y={y0}
              width={Math.max(1, x1 - x0)}
              height={Math.max(1, y1 - y0)}
              fill={nodeFill(node.kind)}
              rx={2}
              className={cn(clickable && "cursor-pointer opacity-90 hover:opacity-100")}
              onClick={() => {
                if (node.href) router.push(node.href);
              }}
            >
              <title>
                {node.label}: {node.amountLabel}
              </title>
            </rect>
            <text
              x={labelX}
              y={(y0 + y1) / 2}
              dy="0.35em"
              textAnchor={textAnchor}
              className={cn(
                "fill-foreground text-[11px]",
                clickable && "cursor-pointer",
              )}
              onClick={() => {
                if (node.href) router.push(node.href);
              }}
            >
              <tspan className="font-medium">{node.label}</tspan>
              <tspan className="fill-muted-foreground">
                {` ${node.amountLabel}`}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
