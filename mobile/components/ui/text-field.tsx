import { forwardRef } from "react";
import {
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { useCSSVariable } from "uniwind";

import { textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type TextFieldProps = TextInputProps;

/** Themed text field for auth and other forms. */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextField({ style, placeholderTextColor, className, ...props }, ref) {
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
        className={cn(
          "min-h-[52px] rounded-2xl border px-4",
          textVariants({ variant: "label", weight: "regular" }),
          className,
        )}
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
