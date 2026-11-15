import { useEffect } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  SecureField,
  Text as SwiftText,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  foregroundStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";

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

/** Full-screen SwiftUI Form host for Profile destinations. */
export function SettingsForm({ children, footer }: SettingsFormProps) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  return (
    <View style={{ flex: 1, backgroundColor, overflow: "hidden" }}>
      <Host style={{ flex: 1, backgroundColor }}>
        <Form>
          {children}
          {footer ? <Section>{footer}</Section> : null}
        </Form>
      </Host>
    </View>
  );
}

export function SettingsSection({
  title,
  footer,
  children,
}: SettingsSectionProps) {
  return (
    <Section title={title} footer={footer}>
      {children}
    </Section>
  );
}

export function SettingsField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: SettingsFieldProps) {
  const text = useNativeState(value);
  useEffect(() => {
    if (text.get() !== value) text.set(value);
  }, [text, value]);

  return (
    <LabeledContent label={label}>
      <TextField
        text={text}
        placeholder={placeholder}
        axis={multiline ? "vertical" : "horizontal"}
        onTextChange={onChangeText}
      />
    </LabeledContent>
  );
}

export function SettingsSecureField({
  label,
  value,
  onChangeText,
  placeholder,
}: SettingsSecureFieldProps) {
  const text = useNativeState(value);
  useEffect(() => {
    if (text.get() !== value) text.set(value);
  }, [text, value]);

  return (
    <LabeledContent label={label}>
      <SecureField
        text={text}
        placeholder={placeholder}
        onTextChange={onChangeText}
      />
    </LabeledContent>
  );
}

export function SettingsLabeledValue({
  label,
  value,
}: SettingsLabeledValueProps) {
  return (
    <LabeledContent label={label}>
      <SwiftText
        modifiers={[
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        {value}
      </SwiftText>
    </LabeledContent>
  );
}

export function SettingsButton({
  label,
  onPress,
  disabled: isDisabled,
  destructive,
  variant = "bordered",
  hosted = false,
}: SettingsButtonProps) {
  const button = (
    <Button
      label={label}
      role={destructive ? "destructive" : "default"}
      onPress={onPress}
      modifiers={[
        buttonStyle(variant),
        ...(isDisabled ? [disabled(true)] : []),
      ]}
    />
  );
  if (!hosted) return button;
  return (
    <Host matchContents style={{ alignSelf: "stretch", minHeight: 44 }}>
      {button}
    </Host>
  );
}

export function SettingsPicker({
  label,
  selection,
  options,
  onSelectionChange,
}: SettingsPickerProps) {
  return (
    <Picker
      label={label}
      selection={selection}
      onSelectionChange={(next) => {
        if (typeof next === "string") onSelectionChange(next);
      }}
    >
      {options.map((option) => (
        <SwiftText key={option} modifiers={[tag(option)]}>
          {option}
        </SwiftText>
      ))}
    </Picker>
  );
}

export function SettingsFormText({
  children,
  tone = "default",
}: SettingsFormTextProps) {
  const style =
    tone === "destructive"
      ? foregroundStyle("#FF453A")
      : tone === "secondary"
        ? foregroundStyle({ type: "hierarchical", style: "secondary" })
        : foregroundStyle({ type: "hierarchical", style: "primary" });
  return <SwiftText modifiers={[style]}>{children}</SwiftText>;
}
