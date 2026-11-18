/**
 * Resolve the settings Usage filter window from query params / presets.
 * `to` is exclusive; `from` is inclusive.
 */

export type UsageFilterPreset = "cycle" | "7d" | "30d" | "all";

export type UsagePeriodOption = {
  readonly periodStart: Date;
  readonly periodEnd: Date | null;
  readonly totalCents: number;
};

export type ResolvedUsageWindow = {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly preset: UsageFilterPreset | "period" | "range";
  readonly periodStart: string | null;
  readonly label: string;
};

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatShortRange(from: Date, toExclusive: Date): string {
  const endInclusive = new Date(toExclusive.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const sameYear = from.getUTCFullYear() === endInclusive.getUTCFullYear();
  const fromLabel = from.toLocaleDateString(
    undefined,
    sameYear ? opts : { ...opts, year: "numeric" },
  );
  const toLabel = endInclusive.toLocaleDateString(undefined, {
    ...opts,
    year: "numeric",
  });
  return `${fromLabel} – ${toLabel}`;
}

export function attachPeriodEnds(
  periods: readonly { readonly periodStart: Date; readonly totalCents: number }[],
  currentPeriodEnd: Date | null,
): readonly UsagePeriodOption[] {
  const chronological = [...periods].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );
  return chronological.map((period, index) => ({
    periodStart: period.periodStart,
    periodEnd:
      chronological[index + 1]?.periodStart ?? currentPeriodEnd ?? null,
    totalCents: period.totalCents,
  }));
}

/**
 * Pick a usage window. Precedence: explicit from/to → periodStart → preset
 * (default `cycle` when a current period exists, else `30d`).
 */
export function resolveUsageWindow(input: {
  readonly preset?: string | null;
  readonly periodStart?: string | null;
  readonly from?: string | null;
  readonly to?: string | null;
  readonly currentPeriod?: { readonly start: Date; readonly end: Date } | null;
  readonly periods?: readonly UsagePeriodOption[];
  readonly now?: Date;
}): ResolvedUsageWindow {
  const now = input.now ?? new Date();
  const explicitFrom = parseIsoDate(input.from);
  const explicitTo = parseIsoDate(input.to);

  if (explicitFrom || explicitTo) {
    const from = explicitFrom;
    const to = explicitTo;
    return {
      from,
      to,
      preset: "range",
      periodStart: null,
      label:
        from && to
          ? formatShortRange(from, to)
          : from
            ? `Since ${from.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
            : to
              ? `Until ${new Date(to.getTime() - 1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : "Custom range",
    };
  }

  const periodStart = parseIsoDate(input.periodStart);
  if (periodStart) {
    const match = input.periods?.find(
      (period) => period.periodStart.getTime() === periodStart.getTime(),
    );
    const from = periodStart;
    const to =
      match?.periodEnd ??
      (input.currentPeriod &&
      input.currentPeriod.start.getTime() === periodStart.getTime()
        ? input.currentPeriod.end
        : null);
    return {
      from,
      to,
      preset: "period",
      periodStart: periodStart.toISOString(),
      label: to ? formatShortRange(from, to) : formatShortRange(from, now),
    };
  }

  const rawPreset = (input.preset ?? "").trim().toLowerCase();
  const preset: UsageFilterPreset =
    rawPreset === "7d" ||
    rawPreset === "30d" ||
    rawPreset === "all" ||
    rawPreset === "cycle"
      ? rawPreset
      : input.currentPeriod
        ? "cycle"
        : "30d";

  if (preset === "all") {
    return {
      from: null,
      to: null,
      preset,
      periodStart: null,
      label: "All time",
    };
  }

  if (preset === "cycle" && input.currentPeriod) {
    return {
      from: input.currentPeriod.start,
      to: input.currentPeriod.end,
      preset,
      periodStart: input.currentPeriod.start.toISOString(),
      label: "This billing cycle",
    };
  }

  if (preset === "7d") {
    const from = startOfUtcDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    return {
      from,
      to: now,
      preset: "7d",
      periodStart: null,
      label: "Last 7 days",
    };
  }

  // 30d (also fallback when cycle requested but no current period)
  const from = startOfUtcDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  return {
    from,
    to: now,
    preset: preset === "cycle" ? "30d" : preset,
    periodStart: null,
    label: "Last 30 days",
  };
}
