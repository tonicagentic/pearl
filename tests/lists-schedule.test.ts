import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  dayOfMonthFromIso,
  formatScheduleSummary,
  isScheduleDue,
  shouldSkipSpawnItem,
  todayInTimeZone,
  weekdayInTimeZone,
} from "../lib/lists/schedule.ts";

describe("list schedule helpers", () => {
  it("formats today in America/Los_Angeles as YYYY-MM-DD", () => {
    // 2024-01-15 10:00 UTC → still Jan 15 in Pacific (PST, UTC-8)
    const noonUtc = new Date("2024-01-15T18:00:00.000Z");
    assert.equal(todayInTimeZone("America/Los_Angeles", noonUtc), "2024-01-15");

    // 2024-01-16 07:00 UTC → Jan 15 evening Pacific
    const lateUtc = new Date("2024-01-16T07:00:00.000Z");
    assert.equal(todayInTimeZone("America/Los_Angeles", lateUtc), "2024-01-15");
  });

  it("reports weekday in America/Los_Angeles", () => {
    // Monday Jan 15 2024 12:00 Pacific = 20:00 UTC
    const monday = new Date("2024-01-15T20:00:00.000Z");
    assert.equal(weekdayInTimeZone("America/Los_Angeles", monday), 1);

    // Sunday Jan 14 2024 12:00 Pacific = 20:00 UTC
    const sunday = new Date("2024-01-14T20:00:00.000Z");
    assert.equal(weekdayInTimeZone("America/Los_Angeles", sunday), 0);
  });

  it("parses day of month from ISO dates", () => {
    assert.equal(dayOfMonthFromIso("2024-02-01"), 1);
    assert.equal(dayOfMonthFromIso("2024-02-28"), 28);
  });

  it("never matches manual lists", () => {
    assert.equal(
      isScheduleDue(
        { cadence: null, weekday: null, monthDay: null },
        "2024-01-15",
        1,
      ),
      false,
    );
  });

  it("matches daily every day", () => {
    assert.equal(
      isScheduleDue(
        { cadence: "daily", weekday: null, monthDay: null },
        "2024-01-15",
        1,
      ),
      true,
    );
  });

  it("matches weekly only on the configured weekday", () => {
    const sunday = { cadence: "weekly" as const, weekday: 0, monthDay: null };
    assert.equal(isScheduleDue(sunday, "2024-01-14", 0), true);
    assert.equal(isScheduleDue(sunday, "2024-01-15", 1), false);
  });

  it("matches monthly only on the configured day (1–28)", () => {
    const first = { cadence: "monthly" as const, weekday: null, monthDay: 1 };
    assert.equal(isScheduleDue(first, "2024-02-01", 4), true);
    assert.equal(isScheduleDue(first, "2024-02-02", 5), false);

    const invalid = {
      cadence: "monthly" as const,
      weekday: null,
      monthDay: 31,
    };
    assert.equal(isScheduleDue(invalid, "2024-01-31", 3), false);
  });

  it("skips items with an open list issue or the same occurrence", () => {
    const open = new Set(["a"]);
    const spawned = new Set(["b"]);
    assert.equal(shouldSkipSpawnItem("a", open, spawned), true);
    assert.equal(shouldSkipSpawnItem("b", open, spawned), true);
    assert.equal(shouldSkipSpawnItem("c", open, spawned), false);
  });

  it("summarizes schedules for the UI", () => {
    assert.equal(
      formatScheduleSummary({ cadence: null, weekday: null, monthDay: null }),
      "Manual",
    );
    assert.equal(
      formatScheduleSummary({
        cadence: "daily",
        weekday: null,
        monthDay: null,
      }),
      "Every day",
    );
    assert.equal(
      formatScheduleSummary({
        cadence: "weekly",
        weekday: 0,
        monthDay: null,
      }),
      "Every Sunday",
    );
    assert.equal(
      formatScheduleSummary({
        cadence: "monthly",
        weekday: null,
        monthDay: 1,
      }),
      "Monthly on the 1st",
    );
    assert.equal(
      formatScheduleSummary({
        cadence: "monthly",
        weekday: null,
        monthDay: 22,
      }),
      "Monthly on the 22nd",
    );
  });
});

describe("task list migration", () => {
  it("ships migration 0039 and a journal entry", () => {
    const root = join(import.meta.dirname, "..");
    const sql = readFileSync(
      join(root, "lib/db/migrations/0039_task_lists.sql"),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE "task_list"/);
    assert.match(sql, /CREATE TABLE "task_list_item"/);
    assert.match(sql, /idx_issue_list_item_occurrence/);

    const journal = JSON.parse(
      readFileSync(join(root, "lib/db/migrations/meta/_journal.json"), "utf8"),
    ) as { entries: readonly { tag: string }[] };
    assert.ok(
      journal.entries.some((entry) => entry.tag === "0039_task_lists"),
      "journal missing 0039_task_lists",
    );
  });
});
