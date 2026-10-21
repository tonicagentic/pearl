import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPOSER_MODELS,
  DEFAULT_MODEL_KEY,
  configureModelSelectionPersistence,
  getModelSelection,
  restoreModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "../mobile/src/model-selection.ts";

test("model preference changes update the composer and save allowlisted keys", async () => {
  const writes = [];
  let updates = 0;
  const unsubscribe = subscribeModelSelection(() => updates++);
  configureModelSelectionPersistence(async (key) => { writes.push(key); });
  const key = COMPOSER_MODELS.find((model) => model.key !== getModelSelection()).key;
  await setModelSelection(key);
  assert.equal(getModelSelection(), key);
  assert.deepEqual(writes, [key]);
  assert.equal(updates, 1);
  await setModelSelection("unlisted-model");
  assert.deepEqual(writes, [key]);
  // Tapping the selected row again can retry a failed disk write.
  await setModelSelection(key);
  assert.deepEqual(writes, [key, key]);
  assert.equal(updates, 1);
  unsubscribe();
});

test("cold-start restore accepts only allowlisted keys and cannot overwrite a newer choice", async () => {
  await restoreModelSelection(async () => DEFAULT_MODEL_KEY);
  assert.equal(getModelSelection(), DEFAULT_MODEL_KEY);
  await restoreModelSelection(async () => "obsolete-key");
  assert.equal(getModelSelection(), DEFAULT_MODEL_KEY);

  let resolveRead;
  const read = new Promise((resolve) => { resolveRead = resolve; });
  const restoring = restoreModelSelection(() => read);
  await setModelSelection("grok-4.7");
  resolveRead("muse-spark-open");
  await restoring;
  assert.equal(getModelSelection(), "grok-4.7");
});
