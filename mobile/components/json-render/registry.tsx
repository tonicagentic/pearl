import type { ComponentRegistry } from "@json-render/react-native";
import { comparisonBarShares } from "../../../lib/json-render/comparison-bar";
import { cn } from "@/lib/utils";
import { Pressable, Text, View, Image as RNImage, ScrollView } from "react-native";
import type { ReactNode } from "react";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

const gapClass = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

const badgeToneClass = {
  neutral: "bg-muted",
  positive: "bg-emerald-500/15",
  negative: "bg-red-500/15",
  warning: "bg-amber-500/15",
} as const;

const badgeToneText = {
  neutral: "text-muted-foreground",
  positive: "text-emerald-700 dark:text-emerald-300",
  negative: "text-red-700 dark:text-red-300",
  warning: "text-amber-800 dark:text-amber-200",
} as const;

type Gap = keyof typeof gapClass;
type BadgeTone = keyof typeof badgeToneClass;

function httpsSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : [];
}

/**
 * Mobile registry for the shared Pearl chat catalog.
 * Mirrors web `components/json-render/registry.tsx` with React Native views.
 * RN renderers read props from `element.props`.
 */
export const chatRegistry: ComponentRegistry = {
  Stack: ({ element, children }) => {
    const direction =
      element.props.direction === "horizontal" ? "horizontal" : "vertical";
    const gap = (element.props.gap as Gap | null | undefined) ?? "md";
    return (
      <View
        className={cn(
          direction === "horizontal"
            ? "flex-row flex-wrap items-center"
            : "flex-col",
          gapClass[gap] ?? gapClass.md,
        )}
      >
        {children as ReactNode}
      </View>
    );
  },
  Card: ({ element, children }) => (
    <View className="border-border/60 bg-muted/20 flex-col gap-3 rounded-xl border px-3.5 py-3">
      {(element.props.title || element.props.description) && (
        <View className="flex-col gap-0.5">
          {element.props.title ? (
            <Text className="text-foreground text-[15px] font-medium leading-snug">
              {asString(element.props.title)}
            </Text>
          ) : null}
          {element.props.description ? (
            <Text className="text-muted-foreground text-[13.5px] leading-relaxed">
              {asString(element.props.description)}
            </Text>
          ) : null}
        </View>
      )}
      {children as ReactNode}
    </View>
  ),
  Divider: () => <View className="bg-border/60 my-1 h-px w-full" />,
  Heading: ({ element }) => (
    <Text
      className={cn(
        "text-foreground font-medium",
        element.props.level === "1" && "text-lg leading-7",
        element.props.level === "3" && "text-sm leading-5",
        (element.props.level == null || element.props.level === "2") &&
          "text-base leading-6",
      )}
    >
      {asString(element.props.text)}
    </Text>
  ),
  Text: ({ element }) => (
    <Text
      className={cn(
        "text-[15px] leading-6",
        element.props.muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {asString(element.props.text)}
    </Text>
  ),
  Metric: ({ element }) => (
    <View className="min-w-[7rem] flex-col gap-0.5">
      <Text className="text-muted-foreground text-[12.5px] leading-4">
        {asString(element.props.label)}
      </Text>
      <Text className="text-foreground text-xl font-semibold tracking-tight">
        {asString(element.props.value)}
      </Text>
      {element.props.hint ? (
        <Text className="text-muted-foreground text-[12px] leading-4">
          {asString(element.props.hint)}
        </Text>
      ) : null}
    </View>
  ),
  Badge: ({ element }) => {
    const tone =
      (element.props.tone as BadgeTone | null | undefined) ?? "neutral";
    return (
      <View
        className={cn(
          "self-start rounded-full px-2 py-0.5",
          badgeToneClass[tone] ?? badgeToneClass.neutral,
        )}
      >
        <Text
          className={cn(
            "text-[12px] font-medium",
            badgeToneText[tone] ?? badgeToneText.neutral,
          )}
        >
          {asString(element.props.label)}
        </Text>
      </View>
    );
  },
  ComparisonBar: ({ element }) => {
    const leftLabel = asString(element.props.leftLabel);
    const rightLabel = asString(element.props.rightLabel);
    const leftValue = asNumber(element.props.leftValue);
    const rightValue = asNumber(element.props.rightValue);
    const shares = comparisonBarShares(leftValue, rightValue);
    return (
      <View className="w-full flex-col gap-1.5">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-foreground text-[13px] font-medium">
            {leftLabel} {leftValue}%
          </Text>
          <Text className="text-foreground text-right text-[13px] font-medium">
            {rightLabel} {rightValue}%
          </Text>
        </View>
        <View
          accessibilityRole="image"
          accessibilityLabel={`${leftLabel} ${leftValue}%, ${rightLabel} ${rightValue}%`}
          className="bg-muted h-2.5 w-full flex-row overflow-hidden rounded-full"
        >
          <View
            className="bg-foreground/80 h-full"
            style={{ width: `${shares.left}%` }}
          />
          <View
            className="bg-foreground/25 h-full"
            style={{ width: `${shares.right}%` }}
          />
        </View>
        {element.props.caption ? (
          <Text className="text-muted-foreground text-[12px] leading-4">
            {asString(element.props.caption)}
          </Text>
        ) : null}
      </View>
    );
  },
  Table: ({ element }) => {
    const columns = asStringArray(element.props.columns);
    const rows = Array.isArray(element.props.rows)
      ? (element.props.rows as unknown[]).map((row) => asStringArray(row))
      : [];
    return (
      <ScrollView
        horizontal
        className="border-border/60 rounded-lg border"
        contentContainerClassName="min-w-full"
      >
        <View className="flex-col">
          <View className="bg-muted/40 flex-row">
            {columns.map((column) => (
              <Text
                key={column}
                className="text-muted-foreground min-w-[5.5rem] flex-1 px-2.5 py-1.5 text-[13.5px] font-medium"
              >
                {column}
              </Text>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className="border-border/50 flex-row border-t"
            >
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  className="text-foreground min-w-[5.5rem] flex-1 px-2.5 py-1.5 text-[13.5px]"
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  },
  Image: ({ element }) => {
    const src = httpsSrc(element.props.src);
    if (!src) return null;
    return (
      <RNImage
        source={{ uri: src }}
        accessibilityLabel={
          typeof element.props.alt === "string" ? element.props.alt : undefined
        }
        className="border-border/50 h-48 w-full rounded-lg border"
        resizeMode="cover"
      />
    );
  },
  Button: ({ element, emit }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => emit("press")}
      className={cn(
        "self-start rounded-full px-3.5 py-2 active:opacity-80",
        element.props.variant === "outline" &&
          "border-border border bg-transparent",
        element.props.variant === "secondary" && "bg-secondary",
        (element.props.variant == null || element.props.variant === "default") &&
          "bg-primary",
      )}
    >
      <Text
        className={cn(
          "text-[14px] font-medium",
          element.props.variant === "outline" && "text-foreground",
          element.props.variant === "secondary" && "text-secondary-foreground",
          (element.props.variant == null ||
            element.props.variant === "default") &&
            "text-primary-foreground",
        )}
      >
        {asString(element.props.label)}
      </Text>
    </Pressable>
  ),
};
