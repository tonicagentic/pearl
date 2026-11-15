import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import {
  addMemory,
  clearMemories,
  fetchMemories,
  removeMemory,
  updateMemory,
  type MemoryEntry,
  type MemorySnapshot,
} from "@/src/memory-client";

function confirm(title: string, body: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Mobile memory manager: the indexed facts Pearl recalls before every chat.
 * Mirrors the agent's file memory over `/api/memory`.
 */
export function MemoryScreen() {
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const next = await fetchMemories();
          if (cancelled) return;
          setSnapshot(next);
          setError(null);
        } catch (cause) {
          if (cancelled) return;
          setError(
            cause instanceof Error ? cause.message : "Could not load memory.",
          );
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const run = async (action: () => Promise<MemorySnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setSnapshot(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update memory.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const remember = async () => {
    const text = draft.trim();
    if (!text) return;
    const next = await run(() => addMemory(draft));
    if (!next) return;
    if (next.notice === "duplicate") {
      setError("That memory is already saved.");
      return;
    }
    setDraft("");
  };

  const saveEdit = async (index: number) => {
    const next = await run(() => updateMemory(index, editingText));
    if (next) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const forget = async (entry: MemoryEntry) => {
    const ok = await confirm(
      "Forget this memory?",
      "Pearl stops using it on the next message.",
      "Forget",
    );
    if (!ok) return;
    const next = await run(() => removeMemory(entry.index));
    if (next && editingIndex === entry.index) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const forgetAll = async () => {
    const ok = await confirm(
      "Forget all memories?",
      "This removes every saved memory. It cannot be undone.",
      "Forget all",
    );
    if (!ok) return;
    const next = await run(() => clearMemories());
    if (next) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const entries = snapshot?.entries ?? [];

  return (
    <SheetScaffold>
      <Text variant="secondary" className="px-1">
        Facts Pearl keeps across chats. It reads these before every
        conversation. Ask in chat to remember something, or add it here.
      </Text>

      {error ? (
        <Text
          accessibilityRole="alert"
          variant="secondary"
          tone="destructive"
          className="px-1"
        >
          {error}
        </Text>
      ) : null}

      <SettingsCard>
        <View className="gap-3 px-4 py-4">
          <TextField
            editable={!busy}
            maxLength={2048}
            multiline
            onChangeText={setDraft}
            placeholder="A fact or preference to keep"
            style={{ minHeight: 88, paddingTop: 14, paddingBottom: 14 }}
            textAlignVertical="top"
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remember"
            className="min-h-11 items-center justify-center rounded-2xl bg-foreground disabled:opacity-40"
            disabled={busy || draft.trim().length === 0}
            onPress={() => void remember()}
          >
            <Text variant="label" className="text-background">
              {busy ? "Saving…" : "Remember"}
            </Text>
          </Pressable>
        </View>
      </SettingsCard>

      {snapshot && snapshot.entries.length > 0 ? (
        <Text variant="secondary" className="px-1">
          {snapshot.recallCharacters.toLocaleString("en-US")} of{" "}
          {snapshot.recallLimit.toLocaleString("en-US")} characters Pearl can
          recall
        </Text>
      ) : null}

      {snapshot === null && !error ? (
        <ActivityIndicator accessibilityLabel="Loading memories" />
      ) : snapshot === null ? null : entries.length === 0 ? (
        <View className="rounded-[18px] bg-card px-4 py-4">
          <Text variant="body" tone="muted">
            No memories yet. Add one above, or ask Pearl to remember a
            preference in chat.
          </Text>
        </View>
      ) : (
        <SettingsCard>
          {entries.map((entry, index) => {
            const editing = editingIndex === entry.index;
            return (
              <View key={entry.index}>
                <View className="gap-3 px-4 py-3">
                  {editing ? (
                    <TextField
                      editable={!busy}
                      maxLength={2048}
                      multiline
                      onChangeText={setEditingText}
                      style={{ minHeight: 88, paddingTop: 14, paddingBottom: 14 }}
                      textAlignVertical="top"
                      value={editingText}
                    />
                  ) : (
                    <Text variant="label" weight="regular">
                      {entry.text}
                    </Text>
                  )}
                  <View className="flex-row flex-wrap gap-2">
                    {editing ? (
                      <>
                        <ActionChip
                          disabled={busy || editingText.trim().length === 0}
                          label={busy ? "Saving…" : "Save"}
                          onPress={() => void saveEdit(entry.index)}
                        />
                        <ActionChip
                          disabled={busy}
                          label="Cancel"
                          onPress={() => {
                            setEditingIndex(null);
                            setEditingText("");
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <ActionChip
                          disabled={busy}
                          label="Edit"
                          onPress={() => {
                            setError(null);
                            setEditingIndex(entry.index);
                            setEditingText(entry.text);
                          }}
                        />
                        <ActionChip
                          destructive
                          disabled={busy}
                          label="Forget"
                          onPress={() => void forget(entry)}
                        />
                      </>
                    )}
                  </View>
                </View>
                {index < entries.length - 1 ? (
                  <View className="ml-4 h-px bg-border" />
                ) : null}
              </View>
            );
          })}
        </SettingsCard>
      )}

      {entries.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 items-center justify-center"
          disabled={busy}
          onPress={() => void forgetAll()}
        >
          <Text variant="label" tone="destructive" weight="regular">
            Forget all
          </Text>
        </Pressable>
      ) : null}
    </SheetScaffold>
  );
}

function ActionChip({
  label,
  onPress,
  disabled,
  destructive,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-10 justify-center rounded-xl border border-border/60 px-3 active:bg-muted/60 disabled:opacity-40"
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        variant="secondary"
        weight="medium"
        tone={destructive ? "destructive" : "default"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
