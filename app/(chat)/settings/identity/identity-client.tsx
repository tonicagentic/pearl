"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { saveProfileAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileDto } from "@/lib/profile/serialize";
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
} from "@/lib/profile/physical";
import type { ProfileFormInput } from "@/lib/profile/validation";
import { cn } from "@/lib/utils";

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
  if (options.includes(selected)) return selected;
  return custom.trim() || selected;
}

function fromDto(dto: ProfileDto | null): FormState {
  const build = optionOrCustom([...BUILD_OPTIONS], dto?.build);
  const gender = optionOrCustom([...GENDER_OPTIONS], dto?.gender);
  const eye = optionOrCustom(
    EYE_COLOR_OPTIONS.map((o) => o.label),
    dto?.eyeColor,
  );
  const hair = optionOrCustom(
    HAIR_COLOR_OPTIONS.map((o) => o.label),
    dto?.hairColor,
  );
  const skin = optionOrCustom(
    SKIN_TONE_OPTIONS.map((o) => o.label),
    dto?.skinTone,
  );
  return {
    displayName: dto?.displayName ?? "",
    birthdate: dto?.birthdate ?? "",
    nationality: dto?.nationality ?? "",
    height: parseHeight(dto?.height),
    weight: parseWeight(dto?.weight),
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
    measurements: parseMeasurements(dto?.measurements),
    healthNotes: dto?.healthNotes ?? "",
    primaryResidence: dto?.primaryResidence ?? "",
    additionalHomes: dto?.additionalHomes ?? "",
  };
}

function toInput(form: FormState): ProfileFormInput {
  return {
    displayName: form.displayName,
    birthdate: form.birthdate || null,
    nationality: form.nationality,
    height: formatHeight(form.height) || null,
    weight: formatWeight(form.weight) || null,
    build:
      pickLabel(form.build, form.buildCustom, BUILD_OPTIONS) || null,
    gender:
      pickLabel(form.gender, form.genderCustom, GENDER_OPTIONS) || null,
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
  };
}

export function IdentitySettings({
  initialProfile,
}: {
  readonly initialProfile: ProfileDto | null;
}) {
  const [form, setForm] = useState<FormState>(() => fromDto(initialProfile));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSavedAt(null);
        startTransition(() => {
          void saveProfileAction(toInput(form))
            .then((dto) => {
              setForm(fromDto(dto));
              setSavedAt(new Date().toLocaleTimeString());
            })
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error ? cause.message : "Could not save.",
              );
            });
        });
      }}
    >
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Section
        title="About you"
        description="Name and basics Pearl can use when personal context matters."
      >
        <Field
          label="Display name"
          value={form.displayName}
          onChange={(value) => setField("displayName", value)}
          disabled={pending}
        />
        <Field
          label="Birthdate"
          type="date"
          value={form.birthdate}
          onChange={(value) => setField("birthdate", value)}
          disabled={pending}
        />
        <Field
          label="Nationality"
          value={form.nationality}
          onChange={(value) => setField("nationality", value)}
          disabled={pending}
        />
      </Section>

      <Section
        title="Physical"
        description="Optional details for clothing fit, styling, and similar advice."
      >
        <HeightField
          disabled={pending}
          value={form.height}
          onChange={(height) => setField("height", height)}
        />
        <WeightField
          disabled={pending}
          value={form.weight}
          onChange={(weight) => setField("weight", weight)}
        />

        <ChipField
          label="Build"
          options={[...BUILD_OPTIONS, "Custom"]}
          selected={form.build}
          disabled={pending}
          onSelect={(build) => setField("build", build)}
          custom={form.buildCustom}
          onCustomChange={(buildCustom) => setField("buildCustom", buildCustom)}
          showCustom={form.build === "Custom"}
        />

        <ChipField
          label="Gender"
          options={[...GENDER_OPTIONS, "Custom"]}
          selected={form.gender}
          disabled={pending}
          onSelect={(gender) => setField("gender", gender)}
          custom={form.genderCustom}
          onCustomChange={(genderCustom) =>
            setField("genderCustom", genderCustom)
          }
          showCustom={form.gender === "Custom"}
        />

        <SwatchField
          label="Eye color"
          options={EYE_COLOR_OPTIONS}
          selected={form.eyeColor}
          disabled={pending}
          onSelect={(eyeColor) => setField("eyeColor", eyeColor)}
          custom={form.eyeCustom}
          onCustomChange={(eyeCustom) => setField("eyeCustom", eyeCustom)}
          showCustom={form.eyeColor === "Custom"}
        />

        <SwatchField
          label="Hair color"
          options={HAIR_COLOR_OPTIONS}
          selected={form.hairColor}
          disabled={pending}
          onSelect={(hairColor) => setField("hairColor", hairColor)}
          custom={form.hairCustom}
          onCustomChange={(hairCustom) => setField("hairCustom", hairCustom)}
          showCustom={form.hairColor === "Custom"}
        />

        <SwatchField
          label="Skin tone"
          options={SKIN_TONE_OPTIONS}
          selected={form.skinTone}
          disabled={pending}
          onSelect={(skinTone) => setField("skinTone", skinTone)}
          custom={form.skinCustom}
          onCustomChange={(skinCustom) => setField("skinCustom", skinCustom)}
          showCustom={form.skinTone === "Custom"}
        />

        <MeasurementsField
          disabled={pending}
          value={form.measurements}
          onChange={(measurements) => setField("measurements", measurements)}
        />
      </Section>

      <Section
        title="Health"
        description="Anything Pearl should know for health-aware suggestions — conditions, allergies, preferences. Not a medical record."
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          Health notes
          <Textarea
            className="min-h-28 text-sm"
            disabled={pending}
            onChange={(event) => setField("healthNotes", event.target.value)}
            placeholder="e.g. wears contacts, ADHD, pollen allergy, prefer morning workouts…"
            value={form.healthNotes}
          />
        </label>
      </Section>

      <Section
        title="Home"
        description="Where you primarily live and any other places that matter."
      >
        <Field
          label="Primary residence"
          placeholder="City, region, or address shorthand"
          value={form.primaryResidence}
          onChange={(value) => setField("primaryResidence", value)}
          disabled={pending}
        />
        <Field
          label="Additional homes"
          placeholder="Second home, frequent travel base, …"
          value={form.additionalHomes}
          onChange={(value) => setField("additionalHomes", value)}
          disabled={pending}
        />
      </Section>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {savedAt
            ? `Saved at ${savedAt}. Pearl loads this only when fit or health context matters.`
            : "Pearl loads this only when fit, sizing, or health context matters — not every turn."}
        </p>
        <Button disabled={pending} size="sm" type="submit">
          {pending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly type?: "text" | "date";
  readonly placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <Input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function UnitToggle<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly { readonly id: T; readonly label: string }[];
  readonly disabled?: boolean;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs transition-colors",
            value === option.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function HeightField({
  value,
  onChange,
  disabled,
}: {
  readonly value: HeightParts;
  readonly onChange: (value: HeightParts) => void;
  readonly disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">Height</span>
        <UnitToggle<HeightUnit>
          disabled={disabled}
          onChange={(unit) => onChange({ ...value, unit })}
          options={[
            { id: "imperial", label: "ft / in" },
            { id: "metric", label: "cm" },
          ]}
          value={value.unit}
        />
      </div>
      {value.unit === "imperial" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Feet
            <Input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                onChange({ ...value, feet: event.target.value })
              }
              placeholder="5"
              value={value.feet}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Inches
            <Input
              disabled={disabled}
              inputMode="decimal"
              onChange={(event) =>
                onChange({ ...value, inches: event.target.value })
              }
              placeholder="10"
              value={value.inches}
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Centimeters
          <Input
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) => onChange({ ...value, cm: event.target.value })}
            placeholder="178"
            value={value.cm}
          />
        </label>
      )}
    </div>
  );
}

function WeightField({
  value,
  onChange,
  disabled,
}: {
  readonly value: WeightParts;
  readonly onChange: (value: WeightParts) => void;
  readonly disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">Weight</span>
        <UnitToggle<WeightUnit>
          disabled={disabled}
          onChange={(unit) => onChange({ ...value, unit })}
          options={[
            { id: "lb", label: "lb" },
            { id: "kg", label: "kg" },
          ]}
          value={value.unit}
        />
      </div>
      <Input
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange({ ...value, value: event.target.value })}
        placeholder={value.unit === "lb" ? "165" : "75"}
        value={value.value}
      />
    </div>
  );
}

function ChipField({
  label,
  options,
  selected,
  onSelect,
  custom,
  onCustomChange,
  showCustom,
  disabled,
}: {
  readonly label: string;
  readonly options: readonly string[];
  readonly selected: string;
  readonly onSelect: (value: string) => void;
  readonly custom: string;
  readonly onCustomChange: (value: string) => void;
  readonly showCustom: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected === option;
          return (
            <button
              key={option}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
              disabled={disabled}
              onClick={() => onSelect(active ? "" : option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
      {showCustom ? (
        <Input
          disabled={disabled}
          onChange={(event) => onCustomChange(event.target.value)}
          placeholder={`Custom ${label.toLowerCase()}`}
          value={custom}
        />
      ) : null}
    </div>
  );
}

function SwatchField({
  label,
  options,
  selected,
  onSelect,
  custom,
  onCustomChange,
  showCustom,
  disabled,
}: {
  readonly label: string;
  readonly options: readonly { readonly label: string; readonly swatch: string }[];
  readonly selected: string;
  readonly onSelect: (value: string) => void;
  readonly custom: string;
  readonly onCustomChange: (value: string) => void;
  readonly showCustom: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected === option.label;
          return (
            <button
              key={option.label}
              aria-label={option.label}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-md p-1 transition-colors",
                active ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "",
              )}
              disabled={disabled}
              onClick={() => onSelect(active ? "" : option.label)}
              title={option.label}
              type="button"
            >
              <span
                className="size-8 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: option.swatch }}
              />
              <span
                className={cn(
                  "max-w-16 truncate text-[10px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
        <button
          className={cn(
            "group flex flex-col items-center gap-1 rounded-md p-1 transition-colors",
            selected === "Custom"
              ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
              : "",
          )}
          disabled={disabled}
          onClick={() => onSelect(selected === "Custom" ? "" : "Custom")}
          type="button"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-xs text-muted-foreground">
            +
          </span>
          <span className="text-[10px] text-muted-foreground">Custom</span>
        </button>
      </div>
      {showCustom ? (
        <Input
          disabled={disabled}
          onChange={(event) => onCustomChange(event.target.value)}
          placeholder={`Custom ${label.toLowerCase()}`}
          value={custom}
        />
      ) : null}
    </div>
  );
}

function MeasurementsField({
  value,
  onChange,
  disabled,
}: {
  readonly value: MeasurementParts;
  readonly onChange: (value: MeasurementParts) => void;
  readonly disabled?: boolean;
}) {
  const set = (key: keyof MeasurementParts, next: string) => {
    onChange({ ...value, [key]: next });
  };
  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-medium">Measurements</span>
        <p className="text-[11px] text-muted-foreground">
          Optional — use any units that match how you shop.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["chest", "Chest"],
            ["waist", "Waist"],
            ["hips", "Hips"],
            ["inseam", "Inseam"],
            ["shoe", "Shoe size"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex flex-col gap-1 text-[11px] text-muted-foreground"
          >
            {label}
            <Input
              disabled={disabled}
              onChange={(event) => set(key, event.target.value)}
              placeholder={key === "shoe" ? "11 US" : '32"'}
              value={value[key]}
            />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        Other notes
        <Textarea
          className="min-h-16 text-sm"
          disabled={disabled}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="Neck, sleeve, ring size…"
          value={value.notes}
        />
      </label>
    </div>
  );
}
