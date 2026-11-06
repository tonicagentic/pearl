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
  readonly style?: StyleProp<ViewStyle>;
};

/** Full-width pill primary button (Cosmos-style stadium CTA). */
export function Button({
  label,
  loading = false,
  loadingLabel,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const buttonColor = useCSSVariable("--color-primary") as string | undefined;
  const buttonTextColor = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className="min-h-[54px] items-center justify-center rounded-full active:opacity-90"
      disabled={isDisabled}
      style={[
        {
          backgroundColor: buttonColor,
          opacity: isDisabled ? 0.45 : 1,
        },
        style,
      ]}
      {...props}
    >
      <Text
        className="text-[17px] font-semibold"
        style={{ color: buttonTextColor }}
      >
        {loading ? (loadingLabel ?? label) : label}
      </Text>
    </Pressable>
  );
}
