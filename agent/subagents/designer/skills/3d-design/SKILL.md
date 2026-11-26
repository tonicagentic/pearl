---
description: Use when the user wants a 3D scene, product mock, room, or orbitable model authored as a constrained scene file (not text-to-mesh).
---

# 3D design

Author an orbitable scene as `/workspace/<slug>.scene.json`. This skill does
not call a text-to-mesh vendor. Keep geometry to the supported primitive set
so the canvas viewer can render it safely.

## Process

1. Confirm the subject, scale, and whether a still or orbit view matters.
2. Write a `.scene.json` that validates against the scene spec in
   `references/scene-spec.md` (camera, lights, meshes).
3. Link the file with `file://` so the web canvas can open the viewer.
4. For a still image of the scene (for example for mobile), describe the
   framing in chat; a pictorial still can use `generate_image` when the user
   wants a rendered poster rather than the interactive file.

## Rules

- Only the primitives in the scene spec: box, sphere, cylinder, plane.
- Arbitrary JavaScript is not allowed. A glTF URL is allowed only when the
  user supplied the model.
- House prose lint does not apply to `.scene.json`.

## References

- `references/scene-spec.md` — JSON schema for scenes.
