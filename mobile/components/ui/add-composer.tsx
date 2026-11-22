import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { BottomSheet, RNHostView } from "@expo/ui";
import {
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { usePearlScreenBackground } from "@/src/navigation-theme";

type ComposerSnapPoint = "half" | "full";

const DEFAULT_SNAP_POINTS: ComposerSnapPoint[] = ["half", "full"];

/**
 * Shared create sheet for projects, tasks, and agents:
 * muted leading disc + primary trailing disc, optional display title / hero / body.
 * Wizard steps can swap leading (close/back) and trailing (forward/submit).
 */
export function AddComposer({
  open,
  onClose,
  onSubmit,
  canSubmit,
  busy,
  submitAccessibilityLabel = "Create",
  leading = "close",
  onLeadingPress,
  trailing = "submit",
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
  children,
  error,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly canSubmit: boolean;
  readonly busy: boolean;
  readonly submitAccessibilityLabel?: string;
  readonly leading?: "close" | "back";
  /** Defaults to `onClose` when leading is close. */
  readonly onLeadingPress?: () => void;
  readonly trailing?: "forward" | "submit";
  readonly showTitleField?: boolean;
  readonly title?: string;
  readonly onChangeTitle?: (value: string) => void;
  readonly titlePlaceholder?: string;
  readonly titleAccessibilityLabel?: string;
  readonly titleMaxLength?: number;
  readonly titleAutoFocus?: boolean;
  readonly snapPoints?: ComposerSnapPoint[];
  /** Fill the sheet and scroll (agent mark picker). */
  readonly scrollable?: boolean;
  readonly hero?: ReactNode;
  readonly children?: ReactNode;
  readonly error?: string | null;
}) {
  const backgroundColor = usePearlScreenBackground();
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const sheetSnapPoints = [...snapPoints];
  const handleLeading = onLeadingPress ?? onClose;
  const TrailingIcon = trailing === "forward" ? ChevronRightIcon : ArrowUpIcon;
  const LeadingIcon = leading === "back" ? ChevronLeftIcon : XIcon;

  const header = (
    <View className="mb-3 flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={leading === "back" ? "Back" : "Close"}
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full bg-muted/60 active:opacity-80"
        onPress={handleLeading}
      >
        <Icon as={LeadingIcon} className="size-5 text-foreground" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitAccessibilityLabel}
        hitSlop={8}
        className={`h-10 w-10 items-center justify-center rounded-full ${canSubmit ? "bg-foreground" : "bg-muted/60"}`}
        disabled={!canSubmit}
        onPress={onSubmit}
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon
            as={TrailingIcon}
            className={`size-5 ${canSubmit ? "text-background" : "text-muted-foreground"}`}
          />
        )}
      </Pressable>
    </View>
  );

  const fields = (
    <>
      {hero ? <View className="mb-4">{hero}</View> : null}
      {error ? (
        <Text variant="secondary" tone="destructive" className="mb-3">
          {error}
        </Text>
      ) : null}
      {showTitleField ? (
        <TextInput
          accessibilityLabel={titleAccessibilityLabel ?? titlePlaceholder}
          autoFocus={titleAutoFocus}
          className={cn(
            "min-h-12 tracking-tight",
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
      ) : null}
      {children}
    </>
  );

  return (
    <BottomSheet
      isPresented={open}
      onDismiss={onClose}
      snapPoints={sheetSnapPoints}
      containerColor={backgroundColor}
      contentPadding={{ top: 4, left: 0, right: 0, bottom: 0 }}
    >
      {scrollable ? (
        <RNHostView>
          <View className="flex-1 px-5 pt-1">
            {header}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-6"
              style={{ flex: 1 }}
            >
              {fields}
            </ScrollView>
          </View>
        </RNHostView>
      ) : (
        <RNHostView matchContents>
          <View className="px-5 pb-6 pt-1">
            {header}
            {fields}
          </View>
        </RNHostView>
      )}
    </BottomSheet>
  );
}
