import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyRight,
  type SankeyGraph,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";
import type {
  SpendSankeyGraph,
  SpendSankeyLink,
  SpendSankeyNode,
} from "@/src/spend-sankey";

type LayoutNode = SankeyNode<SpendSankeyNode, SpendSankeyLink> & SpendSankeyNode;
type LayoutLink = SankeyLink<SpendSankeyNode, SpendSankeyLink>;

const HEIGHT = 360;
const NODE_WIDTH = 12;
const NODE_PADDING = 14;

function nodeFill(
  kind: SpendSankeyNode["kind"],
  foreground: string,
  muted: string,
) {
  switch (kind) {
    case "spent":
      return foreground;
    case "group":
      return foreground;
    default:
      return muted;
  }
}

export function SpendSankey({
  graph,
}: {
  readonly graph: SpendSankeyGraph;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(320, Math.min(windowWidth - 32, 720));
  const foreground =
    (useCSSVariable("--color-foreground") as string | undefined) ?? "#111";
  const muted =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#737373";
  const border =
    (useCSSVariable("--color-border") as string | undefined) ?? "#E5E5E5";

  const layout = useMemo(() => {
    if (graph.nodes.length === 0 || graph.links.length === 0) return null;

    const generator = sankey<SpendSankeyNode, SpendSankeyLink>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyRight)
      .extent([
        [4, 8],
        [width - 4, HEIGHT - 8],
      ]);

    const input: SankeyGraph<SpendSankeyNode, SpendSankeyLink> = {
      nodes: graph.nodes.map((n) => ({ ...n })),
      links: graph.links.map((l) => ({ ...l })),
    };

    return generator(input) as SankeyGraph<LayoutNode, LayoutLink> & {
      nodes: LayoutNode[];
      links: LayoutLink[];
    };
  }, [graph, width]);

  if (!layout) {
    return (
      <Text variant="secondary" tone="muted">
        No spend in this month yet.
      </Text>
    );
  }

  const path = sankeyLinkHorizontal();

  return (
    <View style={{ width, alignSelf: "center" }}>
      <Svg width={width} height={HEIGHT}>
        {layout.links.map((link, i) => {
          const source = link.source as LayoutNode;
          const target = link.target as LayoutNode;
          const d = path(link);
          if (!d) return null;
          return (
            <Path
              key={`link-${source.id}-${target.id}-${i}`}
              d={d}
              fill="none"
              stroke={border}
              strokeOpacity={0.9}
              strokeWidth={Math.max(1, link.width ?? 1)}
            />
          );
        })}
        {layout.nodes.map((node) => {
          const x0 = node.x0 ?? 0;
          const x1 = node.x1 ?? 0;
          const y0 = node.y0 ?? 0;
          const y1 = node.y1 ?? 0;
          const labelOnRight = node.kind !== "spent";
          const labelX = labelOnRight ? x1 + 6 : x0 - 6;
          const fill = nodeFill(
            node.kind,
            foreground,
            muted,
          );
          return (
            <G key={node.id}>
              <Rect
                x={x0}
                y={y0}
                width={Math.max(1, x1 - x0)}
                height={Math.max(1, y1 - y0)}
                fill={fill}
                opacity={node.kind === "group" ? 0.7 : 1}
                rx={2}
                onPress={() => {
                  if (node.href) router.push(node.href as never);
                }}
              />
              <SvgText
                x={labelX}
                y={(y0 + y1) / 2}
                fill={foreground}
                fontSize={11}
                fontWeight="500"
                alignmentBaseline="middle"
                textAnchor={labelOnRight ? "start" : "end"}
                onPress={() => {
                  if (node.href) router.push(node.href as never);
                }}
              >
                {`${node.label} ${node.amountLabel}`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
