import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsSection,
} from "@/components/settings/native";
import {
  formatMeasurements,
  parseMeasurements,
  type MeasurementParts,
} from "@/src/profile-physical";
import { fetchProfile, saveProfile } from "@/src/profile-client";

/**
 * Profile → Shop. Clothing sizes are stored on the same profile
 * measurements Pearl already uses for fit.
 */
export function ShopScreen() {
  const [form, setForm] = useState<MeasurementParts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfile()
      .then((profile) => {
        if (cancelled) return;
        setForm(parseMeasurements(profile?.measurements));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to load clothing sizes.",
        );
        setForm(parseMeasurements(null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSize = (key: keyof MeasurementParts, value: string) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSavedHint(null);
  };

  const onSave = () => {
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    void saveProfile({
      measurements: formatMeasurements(form) || null,
    })
      .then((dto) => {
        setForm(parseMeasurements(dto.measurements));
        setSavedHint("Saved.");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save clothing sizes.",
        );
      })
      .finally(() => setSaving(false));
  };

  if (form === null) {
    return <ActivityIndicator accessibilityLabel="Loading clothing sizes" />;
  }

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Pearl reads these when it shops for clothes or checks a fit.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="Clothing sizes">
        <SettingsField
          label="Shirt"
          onChangeText={(shirt) => setSize("shirt", shirt)}
          placeholder="M"
          value={form.shirt}
        />
        <SettingsField
          label="Pants"
          onChangeText={(pants) => setSize("pants", pants)}
          placeholder="32×32"
          value={form.pants}
        />
        <SettingsField
          label="Dress"
          onChangeText={(dress) => setSize("dress", dress)}
          placeholder="6"
          value={form.dress}
        />
        <SettingsField
          label="Jacket"
          onChangeText={(jacket) => setSize("jacket", jacket)}
          placeholder="M"
          value={form.jacket}
        />
        <SettingsField
          label="Shoe"
          onChangeText={(shoe) => setSize("shoe", shoe)}
          placeholder="10 US"
          value={form.shoe}
        />
        <SettingsField
          label="Other sizes"
          multiline
          onChangeText={(notes) => setSize("notes", notes)}
          placeholder="Hat, ring, sleeve"
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
