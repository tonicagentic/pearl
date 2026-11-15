import { Text as RNText, type TextProps as RNTextProps } from "react-native";

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
  label: "medium",
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
}: {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  readonly weight?: TextWeight;
} = {}): string {
  const resolvedTone = tone ?? VARIANT_DEFAULT_TONE[variant];
  const resolvedWeight = weight ?? VARIANT_DEFAULT_WEIGHT[variant];
  return cn(
    VARIANT_SIZE[variant],
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
 */
export function Text({
  variant = "body",
  tone,
  weight,
  className,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(textVariants({ variant, tone, weight }), className)}
      {...props}
    />
  );
}
