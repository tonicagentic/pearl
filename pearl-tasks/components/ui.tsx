import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { useColorScheme } from "react-native";
import { Colors, type ThemeColors } from "@/constants/Colors";

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}

export function Screen({
  children,
  style,
  ...rest
}: ViewProps & { readonly children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[{ flex: 1, backgroundColor: theme.background }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { readonly children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
}: {
  readonly children: React.ReactNode;
  readonly muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: muted ? theme.muted : theme.text,
        fontSize: 16,
        lineHeight: 22,
      }}
    >
      {children}
    </Text>
  );
}

export function Caption({
  children,
  numberOfLines,
}: {
  readonly children: React.ReactNode;
  readonly numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: ViewProps["style"];
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly disabled?: boolean;
}) {
  const theme = useTheme();
  const backgroundColor =
    variant === "primary"
      ? theme.tint
      : variant === "danger"
        ? theme.danger
        : theme.card;
  const color =
    variant === "secondary" ? theme.text : "#FFFFFF";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center",
        borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
        borderColor: theme.border,
      })}
    >
      <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.muted}
      {...props}
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 12,
          color: theme.text,
          fontSize: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        props.style,
      ]}
    />
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={theme.tint} />
    </View>
  );
}

export function SectionLabel({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.muted,
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.3,
        marginBottom: 8,
        marginTop: 18,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}
