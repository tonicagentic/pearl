import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { cn } from "@/lib/utils";

export type TextVariant =
  | "caption"
  | "secondary"
  | "body"
  | "label"
  | "title"
  | "display";

export type TextTone = "default" | "muted" | "destructive" | "primary";

export type TextWeight = "regular" | "medium" | "semibold" | "light";

/** Native px metrics — keep in sync with `--text-*` in `mobile/global.css`. */
export const TEXT_METRICS: Record<
  TextVariant,
  { readonly fontSize: number; readonly lineHeight: number }
> = {
  caption: { fontSize: 12, lineHeight: 16 },
  secondary: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 24 },
  label: { fontSize: 17, lineHeight: 26 },
  title: { fontSize: 22, lineHeight: 28 },
  display: { fontSize: 28, lineHeight: 34 },
};

const VARIANT_SIZE: Record<TextVariant, string> = {
  caption: "text-caption",
  secondary: "text-secondary",
  body: "text-body",
  label: "text-label",
  title: "text-title",
  display: "text-display",
};

const VARIANT_DEFAULT_TONE: Record<TextVariant, TextTone> = {
  caption: "muted",
  secondary: "muted",
  body: "default",
  label: "default",
  title: "default",
  display: "default",
};

const VARIANT_DEFAULT_WEIGHT: Record<TextVariant, TextWeight> = {
  caption: "regular",
  secondary: "regular",
  body: "regular",
  // Message prose uses label at 17/26 — keep regular like the old thread.
  label: "regular",
  title: "semibold",
  display: "semibold",
};

const TONE_CLASS: Record<TextTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
  primary: "text-primary",
};

const WEIGHT_CLASS: Record<TextWeight, string> = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  light: "font-light",
};

/** Class names for a type variant — useful for TextInput and other non-Text hosts. */
export function textVariants({
  variant = "body",
  tone,
  weight,
  /** When false, omit size utilities — pair with `TEXT_METRICS` on `style`. */
  includeSize = true,
}: {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly weight?: TextWeight;
  readonly includeSize?: boolean;
} = {}): string {
  const resolvedTone = tone ?? VARIANT_DEFAULT_TONE[variant];
  const resolvedWeight = weight ?? VARIANT_DEFAULT_WEIGHT[variant];
  return cn(
    includeSize ? VARIANT_SIZE[variant] : null,
    TONE_CLASS[resolvedTone],
    WEIGHT_CLASS[resolvedWeight],
  );
}

export type TextProps = RNTextProps & {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly weight?: TextWeight;
  readonly className?: string;
};

/**
 * Semantic app text. Prefer variants over arbitrary `text-[Npx]`.
 * Caption/secondary default to muted; others to foreground. Override with `tone`.
 * Size comes from native `TEXT_METRICS` (not Uniwind size classes) so thread
 * copy cannot drift from StyleSheet-driven markdown at the same variant.
 */
export function Text({
  variant = "body",
  tone,
  weight,
  className,
  style,
  ...props
}: TextProps) {
  const metrics = TEXT_METRICS[variant];
  return (
    <RNText
      className={cn(
        textVariants({ variant, tone, weight, includeSize: false }),
        className,
      )}
      // Metrics last so caller styles and Uniwind leftovers cannot shrink copy.
      style={[style as StyleProp<TextStyle>, metrics as TextStyle]}
      {...props}
    />
  );
}
