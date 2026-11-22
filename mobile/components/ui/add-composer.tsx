import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import { ChevronLeftIcon, XIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { usePearlScreenBackground } from "@/src/navigation-theme";

type ComposerSnapPoint = "half" | "full";

const DEFAULT_SNAP_POINTS: ComposerSnapPoint[] = ["full"];

/**
 * Shared create sheet for projects, tasks, and agents.
 * Naming step: X + centered sheet title, large centered name, bottom stadium CTA.
 * Later steps: back + body/hero, same bottom CTA.
 */
export function AddComposer({
  open,
  onClose,
  onSubmit,
  canSubmit,
  busy,
  sheetTitle,
  submitLabel = "Create",
  submitAccessibilityLabel,
  leading = "close",
  onLeadingPress,
  showTitleField = true,
  title = "",
  onChangeTitle,
  titlePlaceholder = "",
  titleAccessibilityLabel,
  titleMaxLength = 120,
  titleAutoFocus = true,
  snapPoints = DEFAULT_SNAP_POINTS,
  scrollable = false,
  hero,
  footer,
  children,
  error,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly canSubmit: boolean;
  readonly busy: boolean;
  readonly sheetTitle: string;
  readonly submitLabel?: string;
  readonly submitAccessibilityLabel?: string;
  readonly leading?: "close" | "back";
  /** Defaults to `onClose` when leading is close. */
  readonly onLeadingPress?: () => void;
  readonly showTitleField?: boolean;
  readonly title?: string;
  readonly onChangeTitle?: (value: string) => void;
  readonly titlePlaceholder?: string;
  readonly titleAccessibilityLabel?: string;
  readonly titleMaxLength?: number;
  readonly titleAutoFocus?: boolean;
  readonly snapPoints?: ComposerSnapPoint[];
  /** Fill the sheet and scroll (agent mark picker / long details). */
  readonly scrollable?: boolean;
  readonly hero?: ReactNode;
  /** Row above the primary CTA (template chip, toggles, etc.). */
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly error?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = usePearlScreenBackground();
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const sheetSnapPoints = [...snapPoints];
  const handleLeading = onLeadingPress ?? onClose;
  const LeadingIcon = leading === "back" ? ChevronLeftIcon : XIcon;
  const ctaLabel = busy ? `${submitLabel}…` : submitLabel;

  const header = (
    <View className="mb-2 flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leading === "back" ? "Back" : "Close"}
        hitSlop={8}
        className="z-10 h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-80"
        onPress={handleLeading}
      >
        <Icon as={LeadingIcon} className="size-5 text-foreground" />
      </Pressable>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 items-center justify-center"
      >
        <Text variant="label" weight="semibold">
          {sheetTitle}
        </Text>
      </View>
      {/* Balance the leading disc so the title stays optically centered. */}
      <View className="h-10 w-10" />
    </View>
  );

  const body = showTitleField ? (
    <View className="min-h-[160px] flex-1 items-center justify-center px-2">
      {error ? (
        <Text
          variant="secondary"
          tone="destructive"
          className="mb-3 text-center"
        >
          {error}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={titleAccessibilityLabel ?? titlePlaceholder}
        autoFocus={titleAutoFocus}
        className={cn(
          "w-full text-center tracking-tight",
          textVariants({ variant: "display" }),
        )}
        maxLength={titleMaxLength}
        onChangeText={onChangeTitle}
        onSubmitEditing={onSubmit}
        placeholder={titlePlaceholder}
        placeholderTextColor={placeholderColor}
        returnKeyType="next"
        value={title}
      />
    </View>
  ) : (
    <View className="flex-1">
      {hero ? <View className="mb-4 items-center">{hero}</View> : null}
      {error ? (
        <Text variant="secondary" tone="destructive" className="mb-3">
          {error}
        </Text>
      ) : null}
      {children}
    </View>
  );

  const bottom = (
    <View
      className="gap-3 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {footer}
      <Button
        accessibilityLabel={submitAccessibilityLabel ?? submitLabel}
        label={ctaLabel}
        loading={busy}
        loadingLabel={`${submitLabel}…`}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </View>
  );

  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={sheetSnapPoints}
      containerColor={backgroundColor}
      contentPadding={{ top: 4, left: 0, right: 0, bottom: 0 }}
    >
      <RNHostView>
        <View className="flex-1 px-5 pt-1">
          {header}
          {scrollable ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="grow pb-2"
              style={{ flex: 1 }}
            >
              {body}
            </ScrollView>
          ) : (
            <View className="flex-1">{body}</View>
          )}
          {bottom}
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
