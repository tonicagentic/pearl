import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConnectedAgentUrlError,
  normalizeConnectedAgentUrl,
} from "../lib/connected-agents/url-safety.ts";

describe("normalizeConnectedAgentUrl", () => {
  it("normalizes https URLs and strips a trailing slash", () => {
    assert.equal(
      normalizeConnectedAgentUrl("https://private.example.com/"),
      "https://private.example.com",
    );
  });

  it("rejects http", () => {
    assert.throws(
      () => normalizeConnectedAgentUrl("http://private.example.com"),
      (error: unknown) =>
        error instanceof ConnectedAgentUrlError &&
        /https/i.test(error.message),
    );
  });

  it("rejects credentials in the URL", () => {
    assert.throws(
      () =>
        normalizeConnectedAgentUrl("https://user:pass@private.example.com"),
      (error: unknown) =>
        error instanceof ConnectedAgentUrlError &&
        /credential/i.test(error.message),
    );
  });

  it("rejects localhost", () => {
    assert.throws(
      () => normalizeConnectedAgentUrl("https://localhost"),
      (error: unknown) =>
        error instanceof ConnectedAgentUrlError &&
        /isn.t allowed/i.test(error.message),
    );
  });

  it("rejects loopback IPs", () => {
    assert.throws(
      () => normalizeConnectedAgentUrl("https://127.0.0.1"),
      (error: unknown) =>
        error instanceof ConnectedAgentUrlError &&
        /isn.t allowed/i.test(error.message),
    );
  });

  it("rejects link-local metadata addresses", () => {
    assert.throws(
      () => normalizeConnectedAgentUrl("https://169.254.169.254"),
      (error: unknown) =>
        error instanceof ConnectedAgentUrlError &&
        /isn.t allowed/i.test(error.message),
    );
  });
});
