import { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { CheckIcon, XIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { TaskDateField } from "@/components/tasks/task-date-field";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  createIssueRequest,
  type IssueDto,
} from "@/src/issues-client";
import {
  createDefaultsForBucket,
  type TaskSmartBucket,
} from "@/src/task-smart-lists";

/**
 * Inline quick-add (same window as the list). Modal / SwiftUI BottomSheet
 * both failed to focus TextInput on device — stay in the RN tree instead.
 */
export function TaskQuickAddCard({
  open,
  bucket,
  onClose,
  onCreated,
  areaName,
}: {
  readonly open: boolean;
  readonly bucket: TaskSmartBucket;
  readonly onClose: () => void;
  readonly onCreated: (issue: IssueDto) => void;
  /** When set, overrides the bucket default area (e.g. Finances). */
  readonly areaName?: string;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const cardBg = useCSSVariable("--color-card") as string | undefined;
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryFg = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const defaults = createDefaultsForBucket(bucket);
    setTitle("");
    setDescription("");
    setDueDate(defaults.dueDate ?? "");
    setReviewDate(defaults.reviewDate ?? "");
    setError(null);
    setBusy(false);
    // Mount TextInput on the next frame so autofocus runs after layout.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [open, bucket]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (busy || trimmed.length === 0) return;
    setBusy(true);
    setError(null);
    const defaults = createDefaultsForBucket(bucket);
    void createIssueRequest({
      title: trimmed,
      description: description.trim() || undefined,
      areaName: areaName?.trim() || defaults.areaName,
      dueDate: dueDate.trim() || null,
      reviewDate: reviewDate.trim() || null,
    })
      .then((created) => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        Keyboard.dismiss();
        onCreated(created);
        onClose();
      })
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create the task.",
        );
        setBusy(false);
      });
  }, [
    areaName,
    busy,
    bucket,
    description,
    dueDate,
    onClose,
    onCreated,
    reviewDate,
    title,
  ]);

  if (!open) return null;

  const canSave = !busy && title.trim().length > 0;
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={styles.dimmer}
        onPress={dismiss}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardHost}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg ?? "#FFFFFF",
              marginBottom: bottomInset,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text variant="label" weight="semibold">
              New To-Do
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
              style={styles.iconBtn}
              onPress={dismiss}
            >
              <Icon as={XIcon} className="size-5 text-muted-foreground" />
            </Pressable>
          </View>

          {mounted ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What needs doing?"
              placeholderTextColor={placeholderColor ?? "#8E8E93"}
              returnKeyType="next"
              blurOnSubmit={false}
              editable={!busy}
              autoFocus
              showSoftInputOnFocus
              style={[
                styles.titleInput,
                { color: foregroundColor ?? "#111111" },
              ]}
            />
          ) : (
            <View style={styles.titleInput} />
          )}

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes"
            placeholderTextColor={placeholderColor ?? "#8E8E93"}
            multiline
            editable={!busy}
            style={[styles.notesInput, { color: mutedColor ?? "#8E8E93" }]}
          />

          <View style={styles.dates}>
            <TaskDateField label="Due" value={dueDate} onChange={setDueDate} />
            <TaskDateField
              label="Review"
              value={reviewDate}
              onChange={setReviewDate}
            />
          </View>

          {error ? (
            <Text variant="caption" tone="destructive" className="mt-2">
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add task"
            disabled={!canSave}
            style={[
              styles.saveBtn,
              {
                backgroundColor: primaryColor ?? "#111111",
                opacity: canSave ? 1 : 0.4,
              },
            ]}
            onPress={submit}
          >
            <Icon as={CheckIcon} size={18} color={primaryFg ?? "#FFFFFF"} />
            <Text
              variant="label"
              weight="semibold"
              style={{ color: primaryFg ?? "#FFFFFF" }}
            >
              Add task
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    justifyContent: "flex-end",
  },
  dimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  keyboardHost: {
    width: "100%",
  },
  card: {
    marginHorizontal: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.35)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,120,128,0.12)",
  },
  titleInput: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    paddingVertical: 8,
    minHeight: 40,
  },
  notesInput: {
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 4,
    minHeight: 44,
    maxHeight: 100,
  },
  dates: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  saveBtn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
