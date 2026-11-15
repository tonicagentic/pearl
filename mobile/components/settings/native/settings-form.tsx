import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

import type {
  SettingsButtonProps,
  SettingsFieldProps,
  SettingsFormProps,
  SettingsFormTextProps,
  SettingsLabeledValueProps,
  SettingsPickerProps,
  SettingsSectionProps,
  SettingsSecureFieldProps,
} from "./types";

/**
 * Android / web Profile form host. Uses SheetScaffold + RN fields with the
 * same component API as the iOS SwiftUI Form implementation.
 */
export function SettingsForm({ children, footer }: SettingsFormProps) {
  return <SheetScaffold footer={footer}>{children}</SheetScaffold>;
}

export function SettingsSection({
  title,
  footer,
  children,
}: SettingsSectionProps) {
  return (
    <View className="gap-1.5">
      {title ? (
        <Text variant="secondary" className="px-1 uppercase tracking-[0.04em]">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
      {footer ? <View className="px-1 pt-1">{footer}</View> : null}
    </View>
  );
}

export function SettingsField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: SettingsFieldProps) {
  return (
    <FieldRow label={label}>
      <TextField
        autoCorrect={false}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={multiline ? { minHeight: 88, height: undefined } : undefined}
        value={value}
      />
    </FieldRow>
  );
}

export function SettingsSecureField({
  label,
  value,
  onChangeText,
  placeholder,
}: SettingsSecureFieldProps) {
  return (
    <FieldRow label={label}>
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry
        textContentType="password"
        value={value}
      />
    </FieldRow>
  );
}

export function SettingsLabeledValue({
  label,
  value,
}: SettingsLabeledValueProps) {
  return (
    <FieldRow label={label}>
      <Text variant="label" tone="muted" className="py-2">
        {value}
      </Text>
    </FieldRow>
  );
}

export function SettingsButton({
  label,
  onPress,
  disabled: isDisabled,
  destructive,
  hosted: _hosted,
}: SettingsButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      className={cn(
        "min-h-11 items-center justify-center overflow-hidden rounded-[10px] bg-card active:opacity-80",
        isDisabled && "opacity-50",
      )}
    >
      <Text
        variant="label"
        weight="semibold"
        tone={destructive ? "destructive" : "default"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SettingsPicker({
  label,
  selection,
  options,
  onSelectionChange,
}: SettingsPickerProps) {
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <Text variant="secondary">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const active = selection === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={cn(
                "rounded-full border px-3 py-1.5",
                active ? "border-foreground bg-foreground" : "border-border",
              )}
              onPress={() => onSelectionChange(option)}
            >
              <Text
                variant="secondary"
                style={
                  active && primaryForeground
                    ? { color: primaryForeground }
                    : undefined
                }
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsFormText({
  children,
  tone = "default",
}: SettingsFormTextProps) {
  return (
    <Text
      variant="secondary"
      tone={
        tone === "destructive"
          ? "destructive"
          : tone === "secondary"
            ? "muted"
            : "default"
      }
      className="px-1"
    >
      {children}
    </Text>
  );
}

function FieldRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <Text variant="secondary">{label}</Text>
      {children}
    </View>
  );
}
