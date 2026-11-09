import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contentTypeForWorkspacePath,
  designFileExtension,
  isDesignFilePath,
} from "../agent/lib/design-files.ts";
import { previewKindForPath } from "../lib/design/preview-kind.ts";
import { wrapMermaidAsSvgFixture } from "../lib/design/render.ts";
import { parseDesignScene } from "../lib/design/scene.ts";

describe("design file helpers", () => {
  it("detects design extensions and skips prose content types", () => {
    assert.equal(isDesignFilePath("/workspace/poster.html"), true);
    assert.equal(isDesignFilePath("/workspace/mark.svg"), true);
    assert.equal(isDesignFilePath("/workspace/flow.mmd"), true);
    assert.equal(isDesignFilePath("/workspace/room.scene.json"), true);
    assert.equal(isDesignFilePath("/workspace/essay.md"), false);
    assert.equal(designFileExtension("/workspace/room.scene.json"), ".scene.json");
    assert.equal(
      contentTypeForWorkspacePath("/workspace/poster.html"),
      "text/html; charset=utf-8",
    );
    assert.equal(
      contentTypeForWorkspacePath("/workspace/mark.svg"),
      "image/svg+xml",
    );
    assert.equal(
      contentTypeForWorkspacePath("/workspace/essay.md"),
      "text/markdown",
    );
  });

  it("maps paths to canvas preview kinds", () => {
    assert.equal(previewKindForPath("/workspace/a.md"), "markdown");
    assert.equal(previewKindForPath("/workspace/a.html"), "html");
    assert.equal(previewKindForPath("/workspace/a.svg"), "svg");
    assert.equal(previewKindForPath("/workspace/a.mmd"), "mermaid");
    assert.equal(previewKindForPath("/workspace/a.scene.json"), "scene");
    assert.equal(previewKindForPath("/workspace/a.pdf"), "pdf");
    assert.equal(previewKindForPath("/workspace/a.png"), "image");
    assert.equal(previewKindForPath("/workspace/a.txt"), "text");
  });

  it("wraps Mermaid source as an SVG fixture for offline tests", () => {
    const svg = wrapMermaidAsSvgFixture("flowchart LR\n  a-->b");
    assert.match(svg, /^<svg /);
    assert.match(svg, /flowchart LR/);
  });
});

describe("parseDesignScene", () => {
  const valid = {
    version: 1,
    background: "#0f1115",
    camera: { position: [3, 2, 5], target: [0, 0, 0], fov: 45 },
    lights: [
      { type: "ambient", color: "#ffffff", intensity: 0.4 },
      {
        type: "directional",
        color: "#ffffff",
        intensity: 1,
        position: [4, 6, 2],
      },
    ],
    meshes: [
      {
        id: "hero",
        type: "box",
        position: [0, 0.5, 0],
        color: "#c4a574",
      },
    ],
  };

  it("accepts a valid scene", () => {
    const result = parseDesignScene(JSON.stringify(valid));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.scene.meshes[0]?.type, "box");
    }
  });

  it("rejects unknown mesh types", () => {
    const bad = {
      ...valid,
      meshes: [{ id: "x", type: "torus" }],
    };
    const result = parseDesignScene(JSON.stringify(bad));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Unknown mesh type/);
    }
  });

  it("rejects non-https gltfUrl", () => {
    const bad = { ...valid, gltfUrl: "javascript:alert(1)" };
    const result = parseDesignScene(JSON.stringify(bad));
    assert.equal(result.ok, false);
  });
});
