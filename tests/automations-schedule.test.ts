import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatScheduleSummary,
  normalizeTriggerConfig,
  toScheduleExpression,
} from "../lib/automations/schedule.ts";

const TZ = "America/Los_Angeles";
/** Monday Nov 26, 2026 10:08 PM Pacific = Tue Nov 27 06:08 UTC. */
const NOW = new Date("2026-11-27T06:08:00.000Z");

describe("automation schedule mapping", () => {
  it("defaults once to local date and time", () => {
    const config = normalizeTriggerConfig("once", {}, TZ, NOW);
    assert.equal(config.runAt, "2026-11-26T22:08");
    assert.deepEqual(toScheduleExpression("once", {}, TZ, NOW), {
      type: "single",
      at: "2026-11-26T22:08",
      timezone: TZ,
    });
    assert.match(
      formatScheduleSummary("once", {}, TZ, NOW),
      /Only one time on November 26, 2026 at 10:08 PM/,
    );
  });

  it("maps hourly to a cron hour range", () => {
    const expr = toScheduleExpression(
      "hourly",
      { minute: 0, startHour: 9, endHour: 17 },
      TZ,
      NOW,
    );
    assert.deepEqual(expr, {
      type: "cron",
      cron: "0 9-17 * * *",
      timezone: TZ,
    });
    assert.match(
      formatScheduleSummary(
        "hourly",
        { minute: 0, startHour: 9, endHour: 17 },
        TZ,
        NOW,
      ),
      /Every hour from 9:00 AM to 5:00 PM/,
    );
  });

  it("maps daily / weekdays / weekly", () => {
    assert.deepEqual(toScheduleExpression("daily", {}, TZ, NOW), {
      type: "cron",
      cron: "8 22 * * *",
      timezone: TZ,
    });
    assert.deepEqual(toScheduleExpression("weekdays", {}, TZ, NOW), {
      type: "cron",
      cron: "8 22 * * 1-5",
      timezone: TZ,
    });
    // Nov 26 2026 is Thursday → weekday 4
    assert.deepEqual(toScheduleExpression("weekly", {}, TZ, NOW), {
      type: "cron",
      cron: "8 22 * * 4",
      timezone: TZ,
    });
    assert.match(
      formatScheduleSummary("weekly", {}, TZ, NOW),
      /Every week on Thursday at 10:08 PM/,
    );
  });

  it("maps monthly and annually", () => {
    assert.deepEqual(
      toScheduleExpression("monthly", { dayOfMonth: 1 }, TZ, NOW),
      {
        type: "cron",
        cron: "8 22 1 * *",
        timezone: TZ,
      },
    );
    assert.deepEqual(toScheduleExpression("annually", {}, TZ, NOW), {
      type: "cron",
      cron: "8 22 26 11 *",
      timezone: TZ,
    });
    assert.match(
      formatScheduleSummary("monthly", { dayOfMonth: 1 }, TZ, NOW),
      /On the 1st of each month at 10:08 PM/,
    );
  });

  it("wraps hourly ranges that cross midnight", () => {
    const expr = toScheduleExpression(
      "hourly",
      { minute: 15, startHour: 22, endHour: 2 },
      TZ,
      NOW,
    );
    assert.deepEqual(expr, {
      type: "cron",
      cron: "15 22-23,0-2 * * *",
      timezone: TZ,
    });
  });
});
