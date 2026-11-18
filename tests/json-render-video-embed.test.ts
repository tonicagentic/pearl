import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveVideoEmbed } from "../lib/json-render/video-embed.ts";

describe("resolveVideoEmbed", () => {
  it("accepts https file URLs", () => {
    const resolved = resolveVideoEmbed({
      src: "https://example.com/clip.mp4",
      provider: "file",
    });
    assert.equal(resolved?.provider, "file");
    assert.equal(resolved?.embedUrl, "https://example.com/clip.mp4");
  });

  it("infers YouTube watch URLs", () => {
    const resolved = resolveVideoEmbed({
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    assert.equal(resolved?.provider, "youtube");
    assert.equal(
      resolved?.embedUrl,
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("infers Vimeo URLs", () => {
    const resolved = resolveVideoEmbed({
      src: "https://vimeo.com/123456789",
    });
    assert.equal(resolved?.provider, "vimeo");
    assert.equal(
      resolved?.embedUrl,
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("rejects non-https", () => {
    assert.equal(
      resolveVideoEmbed({ src: "http://example.com/clip.mp4" }),
      null,
    );
  });
});
