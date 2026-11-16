import { useCallback, useEffect, useState } from "react";
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
  BUILD_OPTIONS,
  EYE_COLOR_OPTIONS,
  formatHeight,
  formatMeasurements,
  formatWeight,
  GENDER_OPTIONS,
  HAIR_COLOR_OPTIONS,
  optionOrCustom,
  parseHeight,
  parseMeasurements,
  parseWeight,
  SKIN_TONE_OPTIONS,
  type HeightParts,
  type MeasurementParts,
  type WeightParts,
} from "@/src/profile-physical";
import {
  fetchProfile,
  saveProfile,
  type ProfileDto,
} from "@/src/profile-client";

type FormState = {
  displayName: string;
  birthdate: string;
  nationality: string;
  height: HeightParts;
  weight: WeightParts;
  build: string;
  buildCustom: string;
  gender: string;
  genderCustom: string;
  eyeColor: string;
  eyeCustom: string;
  hairColor: string;
  hairCustom: string;
  skinTone: string;
  skinCustom: string;
  measurements: MeasurementParts;
  healthNotes: string;
  primaryResidence: string;
  additionalHomes: string;
};

function pickLabel(
  selected: string,
  custom: string,
  options: readonly string[],
): string {
  if (selected === "Custom") return custom.trim();
  if ((options as readonly string[]).includes(selected)) return selected;
  return custom.trim() || selected;
}

function emptyForm(): FormState {
  return {
    displayName: "",
    birthdate: "",
    nationality: "",
    height: parseHeight(null),
    weight: parseWeight(null),
    build: "",
    buildCustom: "",
    gender: "",
    genderCustom: "",
    eyeColor: "",
    eyeCustom: "",
    hairColor: "",
    hairCustom: "",
    skinTone: "",
    skinCustom: "",
    measurements: parseMeasurements(null),
    healthNotes: "",
    primaryResidence: "",
    additionalHomes: "",
  };
}

function fromDto(dto: ProfileDto | null): FormState {
  if (!dto) return emptyForm();
  const build = optionOrCustom([...BUILD_OPTIONS], dto.build);
  const gender = optionOrCustom([...GENDER_OPTIONS], dto.gender);
  const eye = optionOrCustom(
    EYE_COLOR_OPTIONS.map((o) => o.label),
    dto.eyeColor,
  );
  const hair = optionOrCustom(
    HAIR_COLOR_OPTIONS.map((o) => o.label),
    dto.hairColor,
  );
  const skin = optionOrCustom(
    SKIN_TONE_OPTIONS.map((o) => o.label),
    dto.skinTone,
  );
  return {
    displayName: dto.displayName ?? "",
    birthdate: dto.birthdate ?? "",
    nationality: dto.nationality ?? "",
    height: parseHeight(dto.height),
    weight: parseWeight(dto.weight),
    build: build.selected ?? "",
    buildCustom: build.custom,
    gender: gender.selected ?? "",
    genderCustom: gender.custom,
    eyeColor: eye.selected ?? "",
    eyeCustom: eye.custom,
    hairColor: hair.selected ?? "",
    hairCustom: hair.custom,
    skinTone: skin.selected ?? "",
    skinCustom: skin.custom,
    measurements: parseMeasurements(dto.measurements),
    healthNotes: dto.healthNotes ?? "",
    primaryResidence: dto.primaryResidence ?? "",
    additionalHomes: dto.additionalHomes ?? "",
  };
}

/**
 * Mobile identity editor: structured profile fields for fit/health/home.
 * Mirrors web Settings → Identity over `/api/profile`.
 */
export function IdentityScreen() {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const profile = await fetchProfile();
      setForm(fromDto(profile));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load profile.",
      );
      setForm(emptyForm());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSavedHint(null);
  };

  const onSave = () => {
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    void saveProfile({
      displayName: form.displayName,
      birthdate: form.birthdate || null,
      nationality: form.nationality,
      height: formatHeight(form.height) || null,
      weight: formatWeight(form.weight) || null,
      build: pickLabel(form.build, form.buildCustom, BUILD_OPTIONS) || null,
      gender: pickLabel(form.gender, form.genderCustom, GENDER_OPTIONS) || null,
      eyeColor:
        pickLabel(
          form.eyeColor,
          form.eyeCustom,
          EYE_COLOR_OPTIONS.map((o) => o.label),
        ) || null,
      hairColor:
        pickLabel(
          form.hairColor,
          form.hairCustom,
          HAIR_COLOR_OPTIONS.map((o) => o.label),
        ) || null,
      skinTone:
        pickLabel(
          form.skinTone,
          form.skinCustom,
          SKIN_TONE_OPTIONS.map((o) => o.label),
        ) || null,
      measurements: formatMeasurements(form.measurements) || null,
      healthNotes: form.healthNotes,
      primaryResidence: form.primaryResidence,
      additionalHomes: form.additionalHomes,
    })
      .then((dto) => {
        setForm(fromDto(dto));
        setSavedHint("Saved.");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save profile.",
        );
      })
      .finally(() => setSaving(false));
  };

  if (form === null) {
    return <ActivityIndicator accessibilityLabel="Loading identity" />;
  }

  const eyeOptions = [
    ...EYE_COLOR_OPTIONS.map((o) => o.label),
    "Custom",
  ] as const;
  const hairOptions = [
    ...HAIR_COLOR_OPTIONS.map((o) => o.label),
    "Custom",
  ] as const;
  const skinOptions = [
    ...SKIN_TONE_OPTIONS.map((o) => o.label),
    "Custom",
  ] as const;

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Pearl loads these for fit and health context when needed — not every
          turn. Free-form memories stay separate.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="About you">
        <SettingsField
          label="Display name"
          onChangeText={(value) => setField("displayName", value)}
          value={form.displayName}
        />
        <SettingsField
          label="Birthdate"
          onChangeText={(value) => setField("birthdate", value)}
          placeholder="1990-01-15"
          value={form.birthdate}
        />
        <SettingsField
          label="Nationality"
          onChangeText={(value) => setField("nationality", value)}
          value={form.nationality}
        />
      </SettingsSection>

      <SettingsSection title="Physical">
        <SettingsPicker
          label="Height unit"
          onSelectionChange={(unit) =>
            setField("height", {
              ...form.height,
              unit: unit === "metric" ? "metric" : "imperial",
            })
          }
          options={["imperial", "metric"]}
          selection={form.height.unit}
        />
        {form.height.unit === "imperial" ? (
          <>
            <SettingsField
              label="Feet"
              onChangeText={(feet) =>
                setField("height", { ...form.height, feet })
              }
              value={form.height.feet}
            />
            <SettingsField
              label="Inches"
              onChangeText={(inches) =>
                setField("height", { ...form.height, inches })
              }
              value={form.height.inches}
            />
          </>
        ) : (
          <SettingsField
            label="Centimeters"
            onChangeText={(cm) => setField("height", { ...form.height, cm })}
            value={form.height.cm}
          />
        )}
        <SettingsPicker
          label="Weight unit"
          onSelectionChange={(unit) =>
            setField("weight", {
              ...form.weight,
              unit: unit === "kg" ? "kg" : "lb",
            })
          }
          options={["lb", "kg"]}
          selection={form.weight.unit}
        />
        <SettingsField
          label="Weight"
          onChangeText={(value) =>
            setField("weight", { ...form.weight, value })
          }
          value={form.weight.value}
        />
        <OptionPicker
          custom={form.buildCustom}
          label="Build"
          onCustomChange={(buildCustom) => setField("buildCustom", buildCustom)}
          onSelect={(build) => setField("build", build)}
          options={[...BUILD_OPTIONS, "Custom"]}
          selected={form.build}
        />
        <OptionPicker
          custom={form.genderCustom}
          label="Gender"
          onCustomChange={(genderCustom) =>
            setField("genderCustom", genderCustom)
          }
          onSelect={(gender) => setField("gender", gender)}
          options={[...GENDER_OPTIONS, "Custom"]}
          selected={form.gender}
        />
        <OptionPicker
          custom={form.eyeCustom}
          label="Eye color"
          onCustomChange={(eyeCustom) => setField("eyeCustom", eyeCustom)}
          onSelect={(eyeColor) => setField("eyeColor", eyeColor)}
          options={[...eyeOptions]}
          selected={form.eyeColor}
        />
        <OptionPicker
          custom={form.hairCustom}
          label="Hair color"
          onCustomChange={(hairCustom) => setField("hairCustom", hairCustom)}
          onSelect={(hairColor) => setField("hairColor", hairColor)}
          options={[...hairOptions]}
          selected={form.hairColor}
        />
        <OptionPicker
          custom={form.skinCustom}
          label="Skin tone"
          onCustomChange={(skinCustom) => setField("skinCustom", skinCustom)}
          onSelect={(skinTone) => setField("skinTone", skinTone)}
          options={[...skinOptions]}
          selected={form.skinTone}
        />
        <SettingsField
          label="Chest"
          onChangeText={(chest) =>
            setField("measurements", { ...form.measurements, chest })
          }
          value={form.measurements.chest}
        />
        <SettingsField
          label="Waist"
          onChangeText={(waist) =>
            setField("measurements", { ...form.measurements, waist })
          }
          value={form.measurements.waist}
        />
        <SettingsField
          label="Hips"
          onChangeText={(hips) =>
            setField("measurements", { ...form.measurements, hips })
          }
          value={form.measurements.hips}
        />
        <SettingsField
          label="Inseam"
          onChangeText={(inseam) =>
            setField("measurements", { ...form.measurements, inseam })
          }
          value={form.measurements.inseam}
        />
        <SettingsField
          label="Shoe"
          onChangeText={(shoe) =>
            setField("measurements", { ...form.measurements, shoe })
          }
          value={form.measurements.shoe}
        />
        <SettingsField
          label="Measurement notes"
          multiline
          onChangeText={(notes) =>
            setField("measurements", { ...form.measurements, notes })
          }
          value={form.measurements.notes}
        />
      </SettingsSection>

      <SettingsSection title="Health">
        <SettingsField
          label="Health notes"
          multiline
          onChangeText={(value) => setField("healthNotes", value)}
          placeholder="Conditions, allergies, preferences…"
          value={form.healthNotes}
        />
      </SettingsSection>

      <SettingsSection title="Home">
        <SettingsField
          label="Primary residence"
          onChangeText={(value) => setField("primaryResidence", value)}
          value={form.primaryResidence}
        />
        <SettingsField
          label="Additional homes"
          onChangeText={(value) => setField("additionalHomes", value)}
          value={form.additionalHomes}
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

function OptionPicker({
  label,
  options,
  selected,
  onSelect,
  custom,
  onCustomChange,
}: {
  readonly label: string;
  readonly options: readonly string[];
  readonly selected: string;
  readonly onSelect: (value: string) => void;
  readonly custom: string;
  readonly onCustomChange: (value: string) => void;
}) {
  const selection = selected || options[0] || "";
  return (
    <>
      <SettingsPicker
        label={label}
        onSelectionChange={onSelect}
        options={options}
        selection={selection}
      />
      {selection === "Custom" ? (
        <SettingsField
          label={`Custom ${label.toLowerCase()}`}
          onChangeText={onCustomChange}
          value={custom}
        />
      ) : null}
    </>
  );
}
