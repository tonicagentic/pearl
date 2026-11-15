import { forwardRef } from "react";
import {
  Platform,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { useCSSVariable } from "uniwind";

import { TEXT_METRICS, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type TextFieldProps = TextInputProps;

/** Fixed field chrome — Uniwind size classes are unreliable on iOS TextInput. */
const FIELD_HEIGHT = 52;
const FIELD_PAD_X = 16;
const FIELD_RADIUS = 16;
const FIELD_FONT = TEXT_METRICS.label.fontSize;
/** Tighter than label lineHeight so the glyph centers in FIELD_HEIGHT. */
const FIELD_LINE = 22;
const FIELD_PAD_Y = (FIELD_HEIGHT - FIELD_LINE) / 2;

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
          textVariants({
            variant: "label",
            weight: "regular",
            includeSize: false,
          }),
          className,
        )}
        placeholderTextColor={placeholderTextColor ?? hintColor ?? undefined}
        underlineColorAndroid="transparent"
        textAlignVertical="center"
        style={[
          {
            height: FIELD_HEIGHT,
            paddingHorizontal: FIELD_PAD_X,
            // Explicit vertical pad so secure + plain fields share one baseline.
            paddingTop: FIELD_PAD_Y,
            paddingBottom: FIELD_PAD_Y,
            borderRadius: FIELD_RADIUS,
            borderWidth: 1,
            fontSize: FIELD_FONT,
            lineHeight: FIELD_LINE,
            color: foregroundColor,
            borderColor,
            backgroundColor: fillColor,
            ...(Platform.OS === "android"
              ? { includeFontPadding: false }
              : null),
          },
          style,
        ]}
        {...props}
      />
    );
  },
);
