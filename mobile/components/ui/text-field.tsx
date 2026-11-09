import { forwardRef } from "react";
import {
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { useCSSVariable } from "uniwind";

export type TextFieldProps = TextInputProps;

/** Themed text field for auth and other forms. */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextField({ style, placeholderTextColor, ...props }, ref) {
    const foregroundColor = useCSSVariable("--color-foreground") as
      | string
      | undefined;
    const hintColor = useCSSVariable("--color-muted-foreground") as
      | string
      | undefined;
    const borderColor = useCSSVariable("--color-border") as string | undefined;
    const fillColor = useCSSVariable("--color-muted") as string | undefined;

    return (
      <TextInput
        ref={ref}
        className="min-h-[52px] rounded-2xl border px-4 text-[17px]"
        placeholderTextColor={placeholderTextColor ?? hintColor ?? undefined}
        style={[
          {
            color: foregroundColor,
            borderColor,
            backgroundColor: fillColor,
          },
          style,
        ]}
        {...props}
      />
    );
  },
);
