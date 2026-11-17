import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
} from "@/components/settings/native";
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
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Facts Pearl keeps across chats. It reads these before every
          conversation. Ask in chat to remember something, or add it here.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="Add">
        <SettingsField
          label="Memory"
          multiline
          onChangeText={setDraft}
          placeholder="A fact or preference to keep"
          value={draft}
        />
        <SettingsButton
          disabled={busy || draft.trim().length === 0}
          label={busy && editingIndex === null ? "Saving…" : "Remember"}
          onPress={() => void remember()}
        />
      </SettingsSection>

      {snapshot && snapshot.entries.length > 0 ? (
        <SettingsFormText tone="secondary">
          {`${snapshot.recallCharacters.toLocaleString("en-US")} of ${snapshot.recallLimit.toLocaleString("en-US")} characters Pearl can recall`}
        </SettingsFormText>
      ) : null}

      {snapshot === null && !error ? (
        <ActivityIndicator accessibilityLabel="Loading memories" />
      ) : snapshot === null ? null : entries.length === 0 ? (
        <SettingsFormText tone="secondary">
          No memories yet. Add one above, or ask Pearl to remember a preference
          in chat.
        </SettingsFormText>
      ) : (
        entries.map((entry) => {
          const editing = editingIndex === entry.index;
          return (
            <SettingsSection key={entry.index} title={`Memory ${entry.index + 1}`}>
              {editing ? (
                <SettingsField
                  label="Text"
                  multiline
                  onChangeText={setEditingText}
                  value={editingText}
                />
              ) : (
                <SettingsLabeledValue label="Text" value={entry.text} />
              )}
              {editing ? (
                <>
                  <SettingsButton
                    disabled={busy || editingText.trim().length === 0}
                    label={busy ? "Saving…" : "Save"}
                    onPress={() => void saveEdit(entry.index)}
                  />
                  <SettingsButton
                    disabled={busy}
                    label="Cancel"
                    onPress={() => {
                      setEditingIndex(null);
                      setEditingText("");
                    }}
                    variant="plain"
                  />
                </>
              ) : (
                <>
                  <SettingsButton
                    disabled={busy}
                    label="Edit"
                    onPress={() => {
                      setError(null);
                      setEditingIndex(entry.index);
                      setEditingText(entry.text);
                    }}
                  />
                  <SettingsButton
                    destructive
                    disabled={busy}
                    label="Forget"
                    onPress={() => void forget(entry)}
                  />
                </>
              )}
            </SettingsSection>
          );
        })
      )}

      {entries.length > 0 ? (
        <SettingsSection>
          <SettingsButton
            destructive
            disabled={busy}
            label="Forget all"
            onPress={() => void forgetAll()}
            variant="plain"
          />
        </SettingsSection>
      ) : null}
    </SettingsForm>
  );
}
