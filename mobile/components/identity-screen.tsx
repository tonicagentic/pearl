import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SheetScaffold } from "@/components/sheet-scaffold";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
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
  type HeightUnit,
  type MeasurementParts,
  type WeightParts,
  type WeightUnit,
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

  return (
    <SheetScaffold
      title="Identity"
      footer={
        <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
          Pearl loads these for fit and health context when needed — not every
          turn. Free-form memories stay separate.
        </Text>
      }
    >
      {form === null ? (
        <ActivityIndicator accessibilityLabel="Loading identity" />
      ) : (
        <View className="gap-5">
          {error ? (
            <Text
              accessibilityRole="alert"
              className="px-1 text-[13px] text-destructive"
            >
              {error}
            </Text>
          ) : null}

          <FieldGroup label="About you">
            <TextRow
              label="Display name"
              onChangeText={(value) => setField("displayName", value)}
              value={form.displayName}
            />
            <TextRow
              label="Birthdate (YYYY-MM-DD)"
              onChangeText={(value) => setField("birthdate", value)}
              placeholder="1990-01-15"
              value={form.birthdate}
            />
            <TextRow
              label="Nationality"
              last
              onChangeText={(value) => setField("nationality", value)}
              value={form.nationality}
            />
          </FieldGroup>

          <FieldGroup label="Physical">
            <HeightRow
              onChange={(height) => setField("height", height)}
              value={form.height}
            />
            <WeightRow
              onChange={(weight) => setField("weight", weight)}
              value={form.weight}
            />
            <ChipRow
              label="Build"
              onCustomChange={(buildCustom) =>
                setField("buildCustom", buildCustom)
              }
              onSelect={(build) => setField("build", build)}
              options={[...BUILD_OPTIONS, "Custom"]}
              selected={form.build}
              custom={form.buildCustom}
            />
            <ChipRow
              label="Gender"
              onCustomChange={(genderCustom) =>
                setField("genderCustom", genderCustom)
              }
              onSelect={(gender) => setField("gender", gender)}
              options={[...GENDER_OPTIONS, "Custom"]}
              selected={form.gender}
              custom={form.genderCustom}
            />
            <SwatchRow
              custom={form.eyeCustom}
              label="Eye color"
              onCustomChange={(eyeCustom) => setField("eyeCustom", eyeCustom)}
              onSelect={(eyeColor) => setField("eyeColor", eyeColor)}
              options={EYE_COLOR_OPTIONS}
              selected={form.eyeColor}
            />
            <SwatchRow
              custom={form.hairCustom}
              label="Hair color"
              onCustomChange={(hairCustom) =>
                setField("hairCustom", hairCustom)
              }
              onSelect={(hairColor) => setField("hairColor", hairColor)}
              options={HAIR_COLOR_OPTIONS}
              selected={form.hairColor}
            />
            <SwatchRow
              custom={form.skinCustom}
              label="Skin tone"
              onCustomChange={(skinCustom) =>
                setField("skinCustom", skinCustom)
              }
              onSelect={(skinTone) => setField("skinTone", skinTone)}
              options={SKIN_TONE_OPTIONS}
              selected={form.skinTone}
            />
            <MeasurementsBlock
              last
              onChange={(measurements) =>
                setField("measurements", measurements)
              }
              value={form.measurements}
            />
          </FieldGroup>

          <FieldGroup label="Health">
            <MultilineRow
              label="Health notes"
              last
              onChangeText={(value) => setField("healthNotes", value)}
              placeholder="Conditions, allergies, preferences…"
              value={form.healthNotes}
            />
          </FieldGroup>

          <FieldGroup label="Home">
            <TextRow
              label="Primary residence"
              onChangeText={(value) => setField("primaryResidence", value)}
              value={form.primaryResidence}
            />
            <TextRow
              label="Additional homes"
              last
              onChangeText={(value) => setField("additionalHomes", value)}
              value={form.additionalHomes}
            />
          </FieldGroup>

          <Pressable
            accessibilityRole="button"
            className="min-h-11 items-center justify-center overflow-hidden rounded-[10px] bg-card active:opacity-80"
            disabled={saving}
            onPress={onSave}
          >
            <Text className="text-[17px] font-semibold text-foreground">
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>

          {savedHint ? (
            <Text className="px-1 text-center text-[13px] text-muted-foreground">
              {savedHint}
            </Text>
          ) : null}
        </View>
      )}
    </SheetScaffold>
  );
}

function FieldGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </Text>
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
    </View>
  );
}

function TextRow({
  label,
  value,
  onChangeText,
  placeholder,
  last = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly last?: boolean;
}) {
  return (
    <View className={cn("gap-2 px-4 pt-2.5 pb-3", !last && "border-b border-border")}>
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <TextField
        autoCapitalize="sentences"
        autoCorrect
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.inlineField}
        value={value}
      />
    </View>
  );
}

function MultilineRow({
  label,
  value,
  onChangeText,
  placeholder,
  last = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly last?: boolean;
}) {
  return (
    <View className={cn("gap-2 px-4 pt-2.5 pb-3", !last && "border-b border-border")}>
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <TextField
        autoCapitalize="sentences"
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.inlineField, styles.multiline]}
        value={value}
      />
    </View>
  );
}

function UnitPills<T extends string>({
  value,
  options,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly { readonly id: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row overflow-hidden rounded-lg border border-border">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            className={cn("px-2.5 py-1.5", active && "bg-primary")}
            onPress={() => onChange(option.id)}
          >
            <Text
              className={cn(
                "text-xs",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HeightRow({
  value,
  onChange,
}: {
  readonly value: HeightParts;
  readonly onChange: (value: HeightParts) => void;
}) {
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[13px] text-muted-foreground">Height</Text>
        <UnitPills<HeightUnit>
          onChange={(unit) => onChange({ ...value, unit })}
          options={[
            { id: "imperial", label: "ft / in" },
            { id: "metric", label: "cm" },
          ]}
          value={value.unit}
        />
      </View>
      {value.unit === "imperial" ? (
        <View className="flex-row gap-2">
          <TextField
            keyboardType="number-pad"
            onChangeText={(feet) => onChange({ ...value, feet })}
            placeholder="5"
            style={[styles.inlineField, styles.halfField]}
            value={value.feet}
          />
          <TextField
            keyboardType="decimal-pad"
            onChangeText={(inches) => onChange({ ...value, inches })}
            placeholder="10"
            style={[styles.inlineField, styles.halfField]}
            value={value.inches}
          />
        </View>
      ) : (
        <TextField
          keyboardType="decimal-pad"
          onChangeText={(cm) => onChange({ ...value, cm })}
          placeholder="178"
          style={styles.inlineField}
          value={value.cm}
        />
      )}
    </View>
  );
}

function WeightRow({
  value,
  onChange,
}: {
  readonly value: WeightParts;
  readonly onChange: (value: WeightParts) => void;
}) {
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[13px] text-muted-foreground">Weight</Text>
        <UnitPills<WeightUnit>
          onChange={(unit) => onChange({ ...value, unit })}
          options={[
            { id: "lb", label: "lb" },
            { id: "kg", label: "kg" },
          ]}
          value={value.unit}
        />
      </View>
      <TextField
        keyboardType="decimal-pad"
        onChangeText={(next) => onChange({ ...value, value: next })}
        placeholder={value.unit === "lb" ? "165" : "75"}
        style={styles.inlineField}
        value={value.value}
      />
    </View>
  );
}

function ChipRow({
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
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 py-0.5">
          {options.map((option) => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                className={cn(
                  "rounded-full border px-3 py-1.5",
                  active
                    ? "border-primary bg-primary"
                    : "border-border bg-transparent",
                )}
                onPress={() => onSelect(active ? "" : option)}
              >
                <Text
                  className={cn(
                    "text-[13px]",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {selected === "Custom" ? (
        <TextField
          onChangeText={onCustomChange}
          placeholder={`Custom ${label.toLowerCase()}`}
          style={styles.inlineField}
          value={custom}
        />
      ) : null}
    </View>
  );
}

function SwatchRow({
  label,
  options,
  selected,
  onSelect,
  custom,
  onCustomChange,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly label: string;
    readonly swatch: string;
  }[];
  readonly selected: string;
  readonly onSelect: (value: string) => void;
  readonly custom: string;
  readonly onCustomChange: (value: string) => void;
}) {
  return (
    <View className="gap-2 border-b border-border px-4 pt-2.5 pb-3">
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2.5 py-1">
          {options.map((option) => {
            const active = selected === option.label;
            return (
              <Pressable
                key={option.label}
                accessibilityLabel={option.label}
                className="w-14 items-center gap-1"
                onPress={() => onSelect(active ? "" : option.label)}
              >
                <View
                  className={cn(
                    "size-8 rounded-full border",
                    active ? "border-2 border-foreground" : "border-border",
                  )}
                  style={{ backgroundColor: option.swatch }}
                />
                <Text
                  className={cn(
                    "text-center text-[10px]",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            className="w-14 items-center gap-1"
            onPress={() => onSelect(selected === "Custom" ? "" : "Custom")}
          >
            <View
              className={cn(
                "size-8 items-center justify-center rounded-full border border-dashed bg-transparent",
                selected === "Custom"
                  ? "border-2 border-foreground"
                  : "border-border",
              )}
            >
              <Text className="text-base text-muted-foreground">+</Text>
            </View>
            <Text className="text-center text-[10px] text-muted-foreground">
              Custom
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {selected === "Custom" ? (
        <TextField
          onChangeText={onCustomChange}
          placeholder={`Custom ${label.toLowerCase()}`}
          style={styles.inlineField}
          value={custom}
        />
      ) : null}
    </View>
  );
}

function MeasurementsBlock({
  value,
  onChange,
  last = false,
}: {
  readonly value: MeasurementParts;
  readonly onChange: (value: MeasurementParts) => void;
  readonly last?: boolean;
}) {
  const set = (key: keyof MeasurementParts, next: string) => {
    onChange({ ...value, [key]: next });
  };
  return (
    <View className={cn("gap-2 px-4 pt-2.5 pb-3", !last && "border-b border-border")}>
      <Text className="text-[13px] text-muted-foreground">Measurements</Text>
      <View className="flex-row gap-2">
        <MiniMeasure
          label="Chest"
          onChangeText={(chest) => set("chest", chest)}
          value={value.chest}
        />
        <MiniMeasure
          label="Waist"
          onChangeText={(waist) => set("waist", waist)}
          value={value.waist}
        />
      </View>
      <View className="flex-row gap-2">
        <MiniMeasure
          label="Hips"
          onChangeText={(hips) => set("hips", hips)}
          value={value.hips}
        />
        <MiniMeasure
          label="Inseam"
          onChangeText={(inseam) => set("inseam", inseam)}
          value={value.inseam}
        />
      </View>
      <MiniMeasure
        label="Shoe size"
        onChangeText={(shoe) => set("shoe", shoe)}
        value={value.shoe}
      />
      <TextField
        multiline
        onChangeText={(notes) => set("notes", notes)}
        placeholder="Other notes…"
        style={[styles.inlineField, styles.multiline]}
        value={value.notes}
      />
    </View>
  );
}

function MiniMeasure({
  label,
  value,
  onChangeText,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
}) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <TextField
        onChangeText={onChangeText}
        placeholder='32"'
        style={styles.inlineField}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inlineField: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  halfField: {
    flex: 1,
  },
});
