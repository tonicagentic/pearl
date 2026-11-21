import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsPicker,
  SettingsSection,
} from "@/components/settings/native";
import {
  archiveCapability,
  fetchCapabilities,
  saveCapability,
  updateCapability,
  type CapabilityDto,
  type CapabilityKind,
  type CapabilityStatus,
} from "@/src/capabilities-client";

const KIND_OPTIONS = ["skill", "product", "service"] as const;
const STATUS_OPTIONS = ["active", "exploring"] as const;

type FormState = {
  name: string;
  kind: CapabilityKind;
  summary: string;
  audience: string;
  proof: string;
  status: CapabilityStatus;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  kind: "skill",
  summary: "",
  audience: "",
  proof: "",
  status: "active",
  notes: "",
});

function fromDto(row: CapabilityDto): FormState {
  return {
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    audience: row.audience ?? "",
    proof: row.proof ?? "",
    status: row.status === "archived" ? "active" : row.status,
    notes: row.notes ?? "",
  };
}

function confirm(
  title: string,
  body: string,
  confirmLabel: string,
): Promise<boolean> {
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
 * Mobile capability catalog: marketable skills, products, and services.
 * Mirrors Settings → Capabilities on the web over `/api/capabilities`.
 */
export function CapabilitiesScreen() {
  const [rows, setRows] = useState<readonly CapabilityDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const reload = useCallback(async (includeArchived = showArchived) => {
    const next = await fetchCapabilities(includeArchived);
    setRows(next);
    setError(null);
    return next;
  }, [showArchived]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const next = await fetchCapabilities(showArchived);
          if (cancelled) return;
          setRows(next);
          setError(null);
        } catch (cause) {
          if (cancelled) return;
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load capabilities.",
          );
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [showArchived]),
  );

  const run = async (action: () => Promise<CapabilityDto>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      await reload();
      return row;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update capability.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const visible =
    rows?.filter((row) => showArchived || row.status !== "archived") ?? [];

  const payload = () => ({
    name: form.name,
    kind: form.kind,
    summary: form.summary,
    audience: form.audience || null,
    proof: form.proof || null,
    status: form.status,
    notes: form.notes || null,
  });

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          What you can sell — a marketable skill, product, or service. Pearl
          uses these for work and career. Free-form facts stay in Memory;
          agent playbooks stay in Skills.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="Catalog">
        <SettingsButton
          disabled={busy}
          label={creating ? "Cancel new" : "New capability"}
          onPress={() => {
            setError(null);
            setEditingId(null);
            setForm(emptyForm());
            setCreating((value) => !value);
          }}
          variant="plain"
        />
        <SettingsButton
          disabled={busy}
          label={showArchived ? "Hide archived" : "Show archived"}
          onPress={() => setShowArchived((value) => !value)}
          variant="plain"
        />
      </SettingsSection>

      {creating ? (
        <SettingsSection title="New capability">
          <CapabilityFields form={form} setForm={setForm} />
          <SettingsButton
            disabled={
              busy || form.name.trim().length === 0 || form.summary.trim().length === 0
            }
            label={busy ? "Saving…" : "Save"}
            onPress={() => {
              void (async () => {
                const row = await run(() => saveCapability(payload()));
                if (row) {
                  setCreating(false);
                  setForm(emptyForm());
                }
              })();
            }}
          />
        </SettingsSection>
      ) : null}

      {rows === null && !error ? (
        <ActivityIndicator accessibilityLabel="Loading capabilities" />
      ) : rows === null ? null : visible.length === 0 ? (
        <SettingsFormText tone="secondary">
          Nothing here yet. Add a skill, product, or service you can sell.
        </SettingsFormText>
      ) : (
        visible.map((row) => {
          const editing = editingId === row.id;
          return (
            <SettingsSection key={row.id} title={row.name}>
              {editing ? (
                <>
                  <CapabilityFields form={form} setForm={setForm} />
                  <SettingsButton
                    disabled={
                      busy ||
                      form.name.trim().length === 0 ||
                      form.summary.trim().length === 0
                    }
                    label={busy ? "Saving…" : "Save"}
                    onPress={() => {
                      void (async () => {
                        const next = await run(() =>
                          updateCapability(row.id, payload()),
                        );
                        if (next) {
                          setEditingId(null);
                          setForm(emptyForm());
                        }
                      })();
                    }}
                  />
                  <SettingsButton
                    disabled={busy}
                    label="Cancel"
                    onPress={() => {
                      setEditingId(null);
                      setForm(emptyForm());
                    }}
                    variant="plain"
                  />
                </>
              ) : (
                <>
                  <SettingsLabeledValue label="Kind" value={row.kind} />
                  <SettingsLabeledValue label="Status" value={row.status} />
                  <SettingsLabeledValue label="Summary" value={row.summary} />
                  {row.audience ? (
                    <SettingsLabeledValue label="Audience" value={row.audience} />
                  ) : null}
                  {row.proof ? (
                    <SettingsLabeledValue label="Proof" value={row.proof} />
                  ) : null}
                  {row.status !== "archived" ? (
                    <>
                      <SettingsButton
                        disabled={busy}
                        label="Edit"
                        onPress={() => {
                          setError(null);
                          setCreating(false);
                          setEditingId(row.id);
                          setForm(fromDto(row));
                        }}
                      />
                      <SettingsButton
                        destructive
                        disabled={busy}
                        label="Archive"
                        onPress={() => {
                          void (async () => {
                            const ok = await confirm(
                              "Archive this capability?",
                              "Pearl will stop treating it as active.",
                              "Archive",
                            );
                            if (!ok) return;
                            await run(() => archiveCapability(row.id));
                          })();
                        }}
                      />
                    </>
                  ) : null}
                </>
              )}
            </SettingsSection>
          );
        })
      )}
    </SettingsForm>
  );
}

function CapabilityFields({
  form,
  setForm,
}: {
  readonly form: FormState;
  readonly setForm: (next: FormState | ((current: FormState) => FormState)) => void;
}) {
  return (
    <>
      <SettingsField
        label="Name"
        onChangeText={(name) => setForm((current) => ({ ...current, name }))}
        placeholder="Maintenance monitoring"
        value={form.name}
      />
      <SettingsPicker
        label="Kind"
        options={[...KIND_OPTIONS]}
        selection={form.kind}
        onSelectionChange={(kind) =>
          setForm((current) => ({
            ...current,
            kind: kind as CapabilityKind,
          }))
        }
      />
      <SettingsPicker
        label="Status"
        options={[...STATUS_OPTIONS]}
        selection={form.status}
        onSelectionChange={(status) =>
          setForm((current) => ({
            ...current,
            status: status as CapabilityStatus,
          }))
        }
      />
      <SettingsField
        label="Summary"
        multiline
        onChangeText={(summary) =>
          setForm((current) => ({ ...current, summary }))
        }
        placeholder="What the buyer gets"
        value={form.summary}
      />
      <SettingsField
        label="Audience"
        onChangeText={(audience) =>
          setForm((current) => ({ ...current, audience }))
        }
        placeholder="Who it is for (optional)"
        value={form.audience}
      />
      <SettingsField
        label="Proof"
        multiline
        onChangeText={(proof) => setForm((current) => ({ ...current, proof }))}
        placeholder="Credentials or results (optional)"
        value={form.proof}
      />
      <SettingsField
        label="Notes"
        multiline
        onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
        placeholder="Optional notes"
        value={form.notes}
      />
    </>
  );
}
