import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatMessageDay,
  formatMessageTime,
  localDayKey,
  shouldShowDaySeparator,
} from "../lib/chat/message-day.ts";

test("localDayKey uses the local calendar day", () => {
  // 2026-03-15T02:00Z is still March 14 in US Pacific (UTC-7/-8).
  const utcMorning = new Date("2026-03-15T02:00:00.000Z");
  const key = localDayKey(utcMorning);
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  // In any timezone the key must match getFullYear/getMonth/getDate locally.
  assert.equal(
    key,
    `${utcMorning.getFullYear()}-${String(utcMorning.getMonth() + 1).padStart(2, "0")}-${String(utcMorning.getDate()).padStart(2, "0")}`,
  );
});

test("formatMessageDay returns Today and Yesterday", () => {
  const now = new Date(2026, 2, 15, 14, 0, 0);
  assert.equal(formatMessageDay(new Date(2026, 2, 15, 9, 0, 0), now), "Today");
  assert.equal(
    formatMessageDay(new Date(2026, 2, 14, 22, 0, 0), now),
    "Yesterday",
  );
});

test("formatMessageDay uses a short date, with year when needed", () => {
  const now = new Date(2026, 2, 15, 14, 0, 0);
  assert.equal(formatMessageDay(new Date(2026, 1, 10, 12, 0, 0), now), "Feb 10");
  assert.equal(
    formatMessageDay(new Date(2025, 10, 24, 12, 0, 0), now),
    "Nov 24, 2025",
  );
});

test("formatMessageTime is a numeric clock", () => {
  const formatted = formatMessageTime(new Date(2026, 2, 15, 9, 5, 0));
  assert.match(formatted, /\d{1,2}:\d{2}/);
});

test("shouldShowDaySeparator on first message and day change", () => {
  const today = new Date(2026, 2, 15, 10, 0, 0);
  const yesterday = new Date(2026, 2, 14, 18, 0, 0);
  assert.equal(shouldShowDaySeparator(today, undefined), true);
  assert.equal(shouldShowDaySeparator(today, today), false);
  assert.equal(shouldShowDaySeparator(today, yesterday), true);
  assert.equal(shouldShowDaySeparator(undefined, today), false);
});

test("UTC midnight and local afternoon can fall on different day keys", () => {
  // Pin a moment that is a different calendar date in UTC vs most US zones.
  const nearUtcMidnight = new Date("2026-06-15T01:30:00.000Z");
  const utcKey = nearUtcMidnight.toISOString().slice(0, 10);
  const localKey = localDayKey(nearUtcMidnight);
  // In UTC+0 they match; elsewhere they often differ — assert the local key
  // is derived from local getters, not the ISO UTC date.
  assert.equal(
    localKey,
    `${nearUtcMidnight.getFullYear()}-${String(nearUtcMidnight.getMonth() + 1).padStart(2, "0")}-${String(nearUtcMidnight.getDate()).padStart(2, "0")}`,
  );
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== "UTC") {
    // Most runners are not UTC; when they differ, today/yesterday must follow local.
    if (utcKey !== localKey) {
      const now = new Date(
        nearUtcMidnight.getFullYear(),
        nearUtcMidnight.getMonth(),
        nearUtcMidnight.getDate(),
        12,
        0,
        0,
      );
      assert.equal(formatMessageDay(nearUtcMidnight, now), "Today");
    }
  }
});
