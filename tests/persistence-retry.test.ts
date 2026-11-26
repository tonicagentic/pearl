import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTransientPersistenceError,
  persistWithRetry,
} from "../lib/chat/persistence-retry.ts";

describe("isTransientPersistenceError", () => {
  it("retries transport and 5xx", () => {
    assert.equal(
      isTransientPersistenceError(new TypeError("Failed to fetch")),
      true,
    );
    assert.equal(
      isTransientPersistenceError(new Error("Failed to save the chat (503).")),
      true,
    );
    assert.equal(
      isTransientPersistenceError(
        Object.assign(new Error("rate limited"), { status: 429 }),
      ),
      true,
    );
  });

  it("does not retry 400 or 401", () => {
    assert.equal(
      isTransientPersistenceError(new Error("Failed to save the chat (400).")),
      false,
    );
    assert.equal(
      isTransientPersistenceError(
        Object.assign(new Error("unauthorized"), { status: 401 }),
      ),
      false,
    );
  });
});

describe("persistWithRetry", () => {
  it("succeeds after a transient failure without raising", async () => {
    let attempts = 0;
    const result = await persistWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw Object.assign(new Error("boom"), { status: 503 });
        }
        return "ok";
      },
      { backoffMs: [1, 1] },
    );
    assert.equal(result, "ok");
    assert.equal(attempts, 2);
  });

  it("throws after exhausting retries", async () => {
    await assert.rejects(
      () =>
        persistWithRetry(
          async () => {
            throw Object.assign(new Error("down"), { status: 503 });
          },
          { backoffMs: [1] },
        ),
      /down/,
    );
  });
});
