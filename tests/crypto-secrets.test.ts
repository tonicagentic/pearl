import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SecretCryptoError,
  decryptSecret,
  encryptSecret,
  resolveCredentialsKey,
} from "../lib/crypto/secrets.ts";

describe("lib/crypto/secrets", () => {
  it("round-trips plaintext with a base64 key", () => {
    const env = {
      ICLOUD_CALDAV_CREDENTIALS_KEY: Buffer.alloc(32, 9).toString("base64"),
    } as NodeJS.ProcessEnv;
    const { ciphertext, keyId } = encryptSecret(
      "app-specific-password",
      "v1",
      env,
    );
    assert.equal(keyId, "v1");
    assert.equal(decryptSecret(ciphertext, env), "app-specific-password");
  });

  it("accepts a 64-char hex key", () => {
    const env = {
      ICLOUD_CALDAV_CREDENTIALS_KEY: "ab".repeat(32),
    } as NodeJS.ProcessEnv;
    assert.equal(resolveCredentialsKey(env).length, 32);
    const { ciphertext } = encryptSecret("secret", "v1", env);
    assert.equal(decryptSecret(ciphertext, env), "secret");
  });

  it("rejects a missing key", () => {
    assert.throws(
      () => resolveCredentialsKey({} as NodeJS.ProcessEnv),
      (error: unknown) =>
        error instanceof SecretCryptoError &&
        /not configured/i.test(error.message),
    );
  });
});
