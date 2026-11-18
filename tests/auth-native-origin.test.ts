import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { withTrustedNativeOrigin } from "../lib/auth-native-origin.ts";

const AUTH_URL = "https://example.test/api/auth/sign-in/email";

afterEach(() => {
  delete process.env.BETTER_AUTH_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
});

describe("withTrustedNativeOrigin", () => {
  it("stamps the canonical origin on an opaque native POST", async () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "null",
      },
      body: JSON.stringify({ email: "a@b.co", password: "secret" }),
    });

    const next = withTrustedNativeOrigin(request);
    assert.notEqual(next, request);
    assert.equal(next.headers.get("origin"), "https://pearl.tonicagentic.com");
    assert.equal(
      await next.text(),
      JSON.stringify({ email: "a@b.co", password: "secret" }),
    );
  });

  it("stamps when Origin is missing entirely", () => {
    process.env.BETTER_AUTH_URL = "https://my-agent-pi-eight.vercel.app";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.equal(
      next.headers.get("origin"),
      "https://my-agent-pi-eight.vercel.app",
    );
  });

  it("stamps opaque Origin even when the native cookie jar is attached", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=abc",
        origin: "null",
      },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.notEqual(next, request);
    assert.equal(next.headers.get("origin"), "https://pearl.tonicagentic.com");
  });

  it("leaves Sec-Fetch-Site browser requests alone", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        origin: "null",
      },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.equal(next, request);
    assert.equal(next.headers.get("origin"), "null");
  });

  it("leaves a real Origin unchanged", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://pearl.tonicagentic.com",
      },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.equal(next, request);
    assert.equal(next.headers.get("origin"), "https://pearl.tonicagentic.com");
  });

  it("stamps Expo Go exp:// origins to the canonical app origin", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "exp://10.0.0.78:8083",
      },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.notEqual(next, request);
    assert.equal(next.headers.get("origin"), "https://pearl.tonicagentic.com");
  });

  it("stamps companion-app custom-scheme origins", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request(AUTH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "pearlbody://",
      },
      body: "{}",
    });

    const next = withTrustedNativeOrigin(request);
    assert.equal(next.headers.get("origin"), "https://pearl.tonicagentic.com");
  });

  it("skips GET requests", () => {
    process.env.BETTER_AUTH_URL = "https://pearl.tonicagentic.com";
    const request = new Request("https://example.test/api/auth/get-session", {
      method: "GET",
    });

    const next = withTrustedNativeOrigin(request);
    assert.equal(next, request);
  });
});
