import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SANDBOX_SETTINGS,
  SandboxSettingsError,
  browserTimeoutMs,
  coderTimeoutMs,
  normalizeSandboxSettings,
} from "../lib/sandbox/settings.ts";

test("missing values fall back to the previous hardcoded sandbox defaults", () => {
  assert.deepEqual(normalizeSandboxSettings({}), DEFAULT_SANDBOX_SETTINGS);
  assert.equal(browserTimeoutMs(DEFAULT_SANDBOX_SETTINGS), 30 * 60_000);
  assert.equal(coderTimeoutMs(DEFAULT_SANDBOX_SETTINGS), 45 * 60_000);
});

test("accepted lifetime and compute values are kept", () => {
  const next = normalizeSandboxSettings({
    browserTimeoutMinutes: 90,
    browserVcpus: 4,
    coderTimeoutMinutes: 30,
    coderVcpus: 8,
  });
  assert.deepEqual(next, {
    browserTimeoutMinutes: 90,
    browserVcpus: 4,
    coderTimeoutMinutes: 30,
    coderVcpus: 8,
  });
});

test("values outside the allowed set are rejected", () => {
  assert.throws(
    () => normalizeSandboxSettings({ browserVcpus: 16 }),
    SandboxSettingsError,
  );
  assert.throws(
    () => normalizeSandboxSettings({ coderTimeoutMinutes: 10 }),
    SandboxSettingsError,
  );
});
