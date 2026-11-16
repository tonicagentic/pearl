import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsPicker,
  SettingsSection,
} from "@/components/settings/native";
import {
  CABIN_OPTIONS,
  DEPTH_OPTIONS,
  formatPlanPreferences,
  HORIZON_OPTIONS,
  parsePlanPreferences,
  pickerValue,
  SEAT_OPTIONS,
  type PlanPreferenceParts,
} from "@/src/plan-preferences";
import { fetchProfile, saveProfile } from "@/src/profile-client";

/**
 * Profile → Plan. Travel preferences live here with the other planning
 * settings Pearl reads when it writes a plan.
 */
export function PlanScreen() {
  const [form, setForm] = useState<PlanPreferenceParts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfile()
      .then((profile) => {
        if (cancelled) return;
        setForm(parsePlanPreferences(profile?.planPreferences));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to load plan settings.",
        );
        setForm(parsePlanPreferences(null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = <K extends keyof PlanPreferenceParts>(
    key: K,
    value: PlanPreferenceParts[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSavedHint(null);
  };

  const onSave = () => {
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    void saveProfile({
      planPreferences: formatPlanPreferences(form) || null,
    })
      .then((dto) => {
        setForm(parsePlanPreferences(dto.planPreferences));
        setSavedHint("Saved.");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save plan settings.",
        );
      })
      .finally(() => setSaving(false));
  };

  if (form === null) {
    return <ActivityIndicator accessibilityLabel="Loading plan settings" />;
  }

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Pearl reads these when it plans a trip or writes a plan for a
          project.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="Travel">
        <SettingsField
          label="Home airport"
          onChangeText={(airport) => setField("airport", airport)}
          placeholder="SFO"
          value={form.airport}
        />
        <SettingsPicker
          label="Seat"
          onSelectionChange={(seat) => setField("seat", seat)}
          options={[...SEAT_OPTIONS]}
          selection={pickerValue(form.seat)}
        />
        <SettingsPicker
          label="Cabin"
          onSelectionChange={(cabin) => setField("cabin", cabin)}
          options={[...CABIN_OPTIONS]}
          selection={pickerValue(form.cabin)}
        />
        <SettingsField
          label="Airlines"
          onChangeText={(airlines) => setField("airlines", airlines)}
          placeholder="United, Alaska"
          value={form.airlines}
        />
        <SettingsField
          label="Hotels"
          onChangeText={(hotels) => setField("hotels", hotels)}
          placeholder="Quiet, walkable"
          value={form.hotels}
        />
      </SettingsSection>

      <SettingsSection title="How you plan">
        <SettingsPicker
          label="Horizon"
          onSelectionChange={(horizon) => setField("horizon", horizon)}
          options={[...HORIZON_OPTIONS]}
          selection={pickerValue(form.horizon)}
        />
        <SettingsPicker
          label="Written plan"
          onSelectionChange={(depth) => setField("depth", depth)}
          options={[...DEPTH_OPTIONS]}
          selection={pickerValue(form.depth)}
        />
        <SettingsField
          label="Notes"
          multiline
          onChangeText={(notes) => setField("notes", notes)}
          placeholder="How you like a plan to start"
          value={form.notes}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsButton
          disabled={saving}
          label={saving ? "Saving…" : "Save"}
          onPress={onSave}
        />
      </SettingsSection>

      {savedHint ? (
        <SettingsFormText tone="secondary">{savedHint}</SettingsFormText>
      ) : null}
    </SettingsForm>
  );
}
