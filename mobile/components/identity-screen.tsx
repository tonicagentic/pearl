import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

import { SheetScaffold } from "@/components/sheet-scaffold";
import { TextField } from "@/components/ui/text-field";
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
  const cardColor = useCSSVariable("--color-card") as string | undefined;

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

          <FieldGroup cardColor={cardColor} label="About you">
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

          <FieldGroup cardColor={cardColor} label="Physical">
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

          <FieldGroup cardColor={cardColor} label="Health">
            <MultilineRow
              label="Health notes"
              last
              onChangeText={(value) => setField("healthNotes", value)}
              placeholder="Conditions, allergies, preferences…"
              value={form.healthNotes}
            />
          </FieldGroup>

          <FieldGroup cardColor={cardColor} label="Home">
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
            className="items-center overflow-hidden rounded-[10px] active:opacity-80"
            disabled={saving}
            onPress={onSave}
            style={{
              backgroundColor: cardColor ?? "#fff",
              minHeight: 44,
              justifyContent: "center",
            }}
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
  cardColor,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly cardColor?: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </Text>
      <View
        className="overflow-hidden rounded-[10px]"
        style={{ backgroundColor: cardColor ?? "#fff" }}
      >
        {children}
      </View>
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
    <View style={[styles.fieldBlock, !last ? styles.fieldBorder : null]}>
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
    <View style={[styles.fieldBlock, !last ? styles.fieldBorder : null]}>
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
    <View style={styles.unitRow}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.unitPill, active ? styles.unitPillActive : null]}
          >
            <Text
              style={[
                styles.unitPillText,
                active ? styles.unitPillTextActive : null,
              ]}
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
    <View style={[styles.fieldBlock, styles.fieldBorder]}>
      <View style={styles.rowBetween}>
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
        <View style={styles.dualInputs}>
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
    <View style={[styles.fieldBlock, styles.fieldBorder]}>
      <View style={styles.rowBetween}>
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
    <View style={[styles.fieldBlock, styles.fieldBorder]}>
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {options.map((option) => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                onPress={() => onSelect(active ? "" : option)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : null,
                  ]}
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
    <View style={[styles.fieldBlock, styles.fieldBorder]}>
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.swatchRow}>
          {options.map((option) => {
            const active = selected === option.label;
            return (
              <Pressable
                key={option.label}
                accessibilityLabel={option.label}
                onPress={() => onSelect(active ? "" : option.label)}
                style={styles.swatchItem}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: option.swatch },
                    active ? styles.swatchActive : null,
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.swatchLabel,
                    active ? styles.swatchLabelActive : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onSelect(selected === "Custom" ? "" : "Custom")}
            style={styles.swatchItem}
          >
            <View
              style={[
                styles.swatch,
                styles.swatchCustom,
                selected === "Custom" ? styles.swatchActive : null,
              ]}
            >
              <Text style={styles.swatchPlus}>+</Text>
            </View>
            <Text style={styles.swatchLabel}>Custom</Text>
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
    <View style={[styles.fieldBlock, !last ? styles.fieldBorder : null]}>
      <Text className="text-[13px] text-muted-foreground">Measurements</Text>
      <View style={styles.dualInputs}>
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
      <View style={styles.dualInputs}>
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
    <View style={styles.halfField}>
      <Text style={styles.miniLabel}>{label}</Text>
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
  fieldBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  fieldBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.29)",
  },
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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  unitRow: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.29)",
    borderRadius: 8,
    overflow: "hidden",
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unitPillActive: {
    backgroundColor: "#111",
  },
  unitPillText: {
    fontSize: 12,
    color: "#8E8E93",
  },
  unitPillTextActive: {
    color: "#fff",
  },
  dualInputs: {
    flexDirection: "row",
    gap: 8,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.29)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  chipText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  chipTextActive: {
    color: "#fff",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  swatchItem: {
    alignItems: "center",
    width: 56,
    gap: 4,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: "#111",
  },
  swatchCustom: {
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  swatchPlus: {
    fontSize: 16,
    color: "#8E8E93",
  },
  swatchLabel: {
    fontSize: 10,
    color: "#8E8E93",
    textAlign: "center",
  },
  swatchLabelActive: {
    color: "#111",
  },
  miniLabel: {
    fontSize: 11,
    color: "#8E8E93",
  },
});
