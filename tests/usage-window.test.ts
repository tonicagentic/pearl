import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attachPeriodEnds,
  resolveUsageWindow,
} from "../lib/usage/window.ts";

test("resolveUsageWindow defaults to current billing cycle", () => {
  const start = new Date("2026-11-01T00:00:00Z");
  const end = new Date("2026-12-01T00:00:00Z");
  const window = resolveUsageWindow({
    currentPeriod: { start, end },
  });
  assert.equal(window.preset, "cycle");
  assert.equal(window.from?.toISOString(), start.toISOString());
  assert.equal(window.to?.toISOString(), end.toISOString());
});

test("resolveUsageWindow supports 7d / 30d / all presets", () => {
  const now = new Date("2026-11-17T18:00:00Z");
  const week = resolveUsageWindow({ preset: "7d", now });
  assert.equal(week.preset, "7d");
  assert.equal(week.from?.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(week.to?.toISOString(), now.toISOString());

  const all = resolveUsageWindow({ preset: "all", now });
  assert.equal(all.preset, "all");
  assert.equal(all.from, null);
  assert.equal(all.to, null);
});

test("resolveUsageWindow resolves a past billing period end from the next start", () => {
  const periods = attachPeriodEnds(
    [
      { periodStart: new Date("2026-09-01T00:00:00Z"), totalCents: 100 },
      { periodStart: new Date("2026-10-01T00:00:00Z"), totalCents: 200 },
    ],
    new Date("2026-11-01T00:00:00Z"),
  );
  const window = resolveUsageWindow({
    periodStart: "2026-09-01T00:00:00.000Z",
    periods,
  });
  assert.equal(window.preset, "period");
  assert.equal(window.from?.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(window.to?.toISOString(), "2026-10-01T00:00:00.000Z");
});

test("explicit from/to wins over preset", () => {
  const window = resolveUsageWindow({
    preset: "all",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(window.preset, "range");
  assert.equal(window.from?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(window.to?.toISOString(), "2026-02-01T00:00:00.000Z");
});
