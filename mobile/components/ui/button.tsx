import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useCSSVariable } from "uniwind";

export type ButtonProps = Omit<PressableProps, "children"> & {
  readonly label: string;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly variant?: "primary" | "secondary";
  readonly style?: StyleProp<ViewStyle>;
};

/** Full-width pill button (Cosmos-style stadium CTA). */
export function Button({
  label,
  loading = false,
  loadingLabel,
  variant = "primary",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const buttonColor = useCSSVariable("--color-primary") as string | undefined;
  const buttonTextColor = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const isDisabled = disabled || loading;
  const secondary = variant === "secondary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className="min-h-[54px] items-center justify-center rounded-full active:opacity-90"
      disabled={isDisabled}
      style={[
        {
          backgroundColor: secondary ? "transparent" : buttonColor,
          borderWidth: secondary ? 1 : 0,
          borderColor: secondary ? borderColor : "transparent",
          opacity: isDisabled ? 0.45 : 1,
        },
        style,
      ]}
      {...props}
    >
      <Text
        className="text-[17px] font-semibold"
        style={{
          color: secondary ? foregroundColor : buttonTextColor,
        }}
      >
        {loading ? (loadingLabel ?? label) : label}
      </Text>
    </Pressable>
  );
}
