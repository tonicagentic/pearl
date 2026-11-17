import type { ReactNode } from "react";

export type SettingsFormProps = {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
};

export type SettingsSectionProps = {
  readonly title?: string;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export type SettingsFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly multiline?: boolean;
};

export type SettingsSecureFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
};

export type SettingsButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly variant?: "bordered" | "plain" | "borderedProminent";
  /** Wrap in Host for use outside SettingsForm (SheetScaffold list screens). */
  readonly hosted?: boolean;
};

export type SettingsPickerProps = {
  readonly label: string;
  readonly selection: string;
  readonly options: readonly string[];
  readonly onSelectionChange: (value: string) => void;
};

export type SettingsLabeledValueProps = {
  readonly label: string;
  readonly value: string;
};

export type SettingsFormTextProps = {
  readonly children: string;
  readonly tone?: "default" | "secondary" | "destructive";
};
